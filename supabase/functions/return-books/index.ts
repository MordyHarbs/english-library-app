// return-books (TECH-PLAN D3) — admin marks loans returned. Reports any waiting
// holds on the returned books so the UI can prompt to fulfill them.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient, requireAdmin } from '../_shared/db.ts'
import { sendEmail } from '../_shared/email.ts'
import { jerusalemToday, fmt } from '../_shared/dates.ts'

Deno.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf
  try {
    try {
      await requireAdmin(req)
    } catch (resp) {
      return resp instanceof Response ? resp : json({ error: 'Forbidden' }, 403)
    }

    const { loan_ids, date_returned } = (await req.json()) as {
      loan_ids: string[]
      date_returned?: string
    }
    if (!Array.isArray(loan_ids) || loan_ids.length === 0)
      return json({ error: 'loan_ids required' }, 400)

    const db = serviceClient()
    const when = date_returned || fmt(jerusalemToday())

    // Which books are being returned (for waitlist detection + emails).
    const { data: returning } = await db
      .from('loans')
      .select('id, book_id, member_id, books(title)')
      .in('id', loan_ids)
      .is('date_returned', null)

    const { error } = await db
      .from('loans')
      .update({ date_returned: when })
      .in('id', loan_ids)
      .is('date_returned', null)
    if (error) throw error

    // Waiting holds: pending/approved items for the returned books.
    const bookIds = [...new Set((returning ?? []).map((l) => l.book_id))]
    const { data: holds } = await db
      .from('reservation_items')
      .select('book_id, status, reservations(id, name)')
      .in('book_id', bookIds)
      .in('status', ['pending', 'approved'])

    const waiting_holds = (holds ?? []).map((h) => ({
      book_id: h.book_id,
      status: h.status,
      reservation_id: (h.reservations as { id: string } | null)?.id ?? null,
      requester: (h.reservations as { name: string } | null)?.name ?? null,
    }))

    await emailReturned(db, returning ?? []).catch((e) =>
      console.error('return email failed:', e.message),
    )

    return json({ ok: true, waiting_holds })
  } catch (e) {
    console.error('return-books:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

async function emailReturned(
  db: ReturnType<typeof serviceClient>,
  returned: { member_id: string; books: unknown }[],
) {
  const { data: toggle } = await db
    .from('settings')
    .select('value')
    .eq('key', 'email_member_on_return')
    .maybeSingle()
  if (!toggle || toggle.value !== true) return // default off

  // Group titles by member.
  const byMember = new Map<string, string[]>()
  for (const r of returned) {
    const title = (r.books as { title: string } | null)?.title ?? 'book'
    byMember.set(r.member_id, [...(byMember.get(r.member_id) ?? []), title])
  }
  for (const [memberId, titles] of byMember) {
    const { data: m } = await db
      .from('members')
      .select('name, email')
      .eq('id', memberId)
      .maybeSingle()
    if (!m) continue
    await sendEmail({
      to: m.email,
      subject: 'Books returned — Ayalot Library',
      html: `<p>Hi ${m.name},</p><p>We've checked these back in:</p><ul>${titles.map((t) => `<li>${t}</li>`).join('')}</ul><p>Thank you!</p>`,
    })
  }
}
