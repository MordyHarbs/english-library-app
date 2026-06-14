// finalize-reservation (TECH-PLAN D3)
// Admin applies per-book approve/reject decisions, sets the optional note, and
// emails the requester ONE summary (best-effort). Undecided items stay pending.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient, requireAdmin } from '../_shared/db.ts'
import { sendEmail } from '../_shared/email.ts'
import { addDays, jerusalemToday, fmt } from '../_shared/dates.ts'

interface Decision {
  item_id: string
  status: 'approved' | 'rejected' | 'lend'
}

Deno.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf

  try {
    try {
      await requireAdmin(req)
    } catch (resp) {
      return resp instanceof Response ? resp : json({ error: 'Forbidden' }, 403)
    }

    const { reservation_id, decisions, message } = (await req.json()) as {
      reservation_id: string
      decisions: Decision[]
      message?: string
    }
    if (!reservation_id || !Array.isArray(decisions) || decisions.length === 0)
      return json({ error: 'reservation_id and decisions are required' }, 400)

    const db = serviceClient()

    // Reservation (for member) + decided items' book ids (for lending).
    const { data: res } = await db
      .from('reservations')
      .select('member_id')
      .eq('id', reservation_id)
      .maybeSingle()
    const { data: itemRows } = await db
      .from('reservation_items')
      .select('id, book_id')
      .in('id', decisions.map((d) => d.item_id))
    const bookOf = new Map((itemRows ?? []).map((r) => [r.id, r.book_id]))

    // Due date for any "lend now" decisions.
    const { data: durRow } = await db
      .from('settings')
      .select('value')
      .eq('key', 'loan_duration_days')
      .maybeSingle()
    const dueDate = fmt(addDays(jerusalemToday(), Number(durRow?.value ?? 14)))

    // Apply each decision (only if still pending — the status guard enforces too).
    for (const d of decisions) {
      if (d.status === 'approved' || d.status === 'rejected') {
        const { error } = await db
          .from('reservation_items')
          .update({ status: d.status, decided_at: new Date().toISOString() })
          .eq('id', d.item_id)
          .eq('reservation_id', reservation_id)
          .eq('status', 'pending')
        if (error) throw error
      } else if (d.status === 'lend') {
        if (!res?.member_id) continue // can't lend a guest request without a member
        // Approve, then create the loan (trigger marks the item fulfilled).
        await db
          .from('reservation_items')
          .update({ status: 'approved', decided_at: new Date().toISOString() })
          .eq('id', d.item_id)
          .eq('reservation_id', reservation_id)
          .eq('status', 'pending')
        const { error } = await db.from('loans').insert({
          book_id: bookOf.get(d.item_id),
          member_id: res.member_id,
          reservation_item_id: d.item_id,
          due_date: dueDate,
        })
        if (error) console.error('lend during finalize failed:', error.message)
      }
    }

    await db
      .from('reservations')
      .update({
        finalized_at: new Date().toISOString(),
        admin_note: message?.trim() || null,
      })
      .eq('id', reservation_id)

    await emailSummary(db, reservation_id, decisions, message).catch((e) =>
      console.error('finalize email failed:', e.message),
    )

    return json({ ok: true })
  } catch (e) {
    console.error('finalize-reservation:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

async function emailSummary(
  db: ReturnType<typeof serviceClient>,
  reservationId: string,
  decisions: Decision[],
  message?: string,
) {
  const { data: toggle } = await db
    .from('settings')
    .select('value')
    .eq('key', 'email_member_on_finalize')
    .maybeSingle()
  if (toggle && toggle.value === false) return

  const { data: res } = await db
    .from('reservations')
    .select('name, email')
    .eq('id', reservationId)
    .maybeSingle()
  if (!res) return

  const ids = decisions.map((d) => d.item_id)
  const { data: items } = await db
    .from('reservation_items')
    .select('id, status, books(title)')
    .in('id', ids)

  const approved = (items ?? [])
    .filter((i) => i.status === 'approved' || i.status === 'fulfilled')
    .map((i) => (i.books as { title: string } | null)?.title ?? 'book')
  const rejected = (items ?? [])
    .filter((i) => i.status === 'rejected')
    .map((i) => (i.books as { title: string } | null)?.title ?? 'book')

  const li = (arr: string[]) => arr.map((t) => `<li>${t}</li>`).join('')
  let html = `<p>Hi ${res.name},</p><p>We've reviewed your book request.</p>`
  if (approved.length)
    html += `<p><b>Ready for pickup:</b></p><ul>${li(approved)}</ul>`
  if (rejected.length)
    html += `<p><b>Not available right now:</b></p><ul>${li(rejected)}</ul>`
  if (message?.trim()) html += `<p>${message.trim().replace(/</g, '&lt;')}</p>`
  html += `<p>Thank you!<br>Ayalot Library</p>`

  const ok = await sendEmail({
    to: res.email,
    subject: 'Update on your Ayalot Library request',
    html,
  })
  if (ok)
    await db.from('email_log').insert({
      type: 'reservation_summary',
      recipient: res.email,
      reservation_id: reservationId,
    })
}
