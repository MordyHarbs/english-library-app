// lend-books (TECH-PLAN D3) — admin lends one or more books to a member.
// Creates loans (a trigger auto-fulfills any linked reservation item) and emails
// the member best-effort. Due date defaults to today + loan_duration_days.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient, requireAdmin } from '../_shared/db.ts'
import { sendEmail } from '../_shared/email.ts'
import { addDays, jerusalemToday, fmt } from '../_shared/dates.ts'

interface LendItem {
  book_id: string
  reservation_item_id?: string | null
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

    const { member_id, items, due_date } = (await req.json()) as {
      member_id: string
      items: LendItem[]
      due_date?: string
    }
    if (!member_id || !Array.isArray(items) || items.length === 0)
      return json({ error: 'member_id and items are required' }, 400)

    const db = serviceClient()

    // Resolve the due date.
    let due = due_date
    if (!due) {
      const { data: s } = await db
        .from('settings')
        .select('value')
        .eq('key', 'loan_duration_days')
        .maybeSingle()
      due = fmt(addDays(jerusalemToday(), Number(s?.value ?? 14)))
    }

    const given = fmt(jerusalemToday())
    const loanIds: string[] = []
    const failed: { book_id: string; reason: string }[] = []

    for (const it of items) {
      const { data, error } = await db
        .from('loans')
        .insert({
          book_id: it.book_id,
          member_id,
          reservation_item_id: it.reservation_item_id ?? null,
          date_given: given,
          due_date: due,
        })
        .select('id')
        .single()
      if (error) failed.push({ book_id: it.book_id, reason: error.message })
      else loanIds.push(data.id)
    }

    await emailLent(db, member_id, loanIds, due).catch((e) =>
      console.error('lend email failed:', e.message),
    )

    return json({ loan_ids: loanIds, failed })
  } catch (e) {
    console.error('lend-books:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

async function emailLent(
  db: ReturnType<typeof serviceClient>,
  memberId: string,
  loanIds: string[],
  due: string,
) {
  if (loanIds.length === 0) return
  const { data: toggle } = await db
    .from('settings')
    .select('value')
    .eq('key', 'email_member_on_lend')
    .maybeSingle()
  if (toggle && toggle.value === false) return

  const { data: member } = await db
    .from('members')
    .select('name, email')
    .eq('id', memberId)
    .maybeSingle()
  if (!member) return

  const { data: loans } = await db
    .from('loans')
    .select('books(title)')
    .in('id', loanIds)
  const list = (loans ?? [])
    .map((l) => `<li>${(l.books as { title: string } | null)?.title ?? 'book'}</li>`)
    .join('')

  const ok = await sendEmail({
    to: member.email,
    subject: 'Books checked out — Ayalot Library',
    html: `<p>Hi ${member.name},</p><p>You've checked out:</p><ul>${list}</ul><p>Please return by <b>${due}</b>. Enjoy!</p>`,
  })
  if (ok)
    await db
      .from('email_log')
      .insert({ type: 'books_lent', recipient: member.email })
}
