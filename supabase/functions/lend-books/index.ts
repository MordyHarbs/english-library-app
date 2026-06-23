// lend-books (TECH-PLAN D3) — admin lends one or more books to a member.
// Creates loans (a trigger auto-fulfills any linked reservation item) and emails
// the member best-effort. Due date defaults to today + loan_duration_days.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient, requireAdmin } from '../_shared/db.ts'
import { sendEmail } from '../_shared/email.ts'
import { addDays, jerusalemToday, fmt } from '../_shared/dates.ts'
import { loadBranding } from '../_shared/branding.ts'

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
    .select('books(title, cover_path)')
    .in('id', loanIds)
  const branding = await loadBranding(db)
  const cards = bookCards(db, (loans ?? []).map((l) => l.books))

  const ok = await sendEmail({
    to: member.email,
    fromName: branding.libraryName,
    subject: `Books checked out - ${branding.libraryName}`,
    html: `<p>Hi ${esc(member.name)},</p><p>You've checked out:</p>${cards}<p>Please return by <b>${due}</b>. Enjoy!</p>`,
  })
  if (ok)
    await db
      .from('email_log')
      .insert({ type: 'books_lent', recipient: member.email })
}

function bookCards(db: ReturnType<typeof serviceClient>, books: unknown[]) {
  let html = `<div style="text-align: center; margin: 20px 0;">`
  for (const raw of books) {
    const book = raw as { title: string; cover_path: string | null } | null
    const title = book?.title ?? 'book'
    const cover = coverUrl(db, book?.cover_path)
    html += `<div style="margin: 16px 8px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; display: inline-block; width: 200px; height: 320px; vertical-align: top; text-align: center; overflow: hidden; background-color: #fafafa;">`
    html += `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">`
    html += `<tr><td height="52" align="center" valign="middle" style="height: 52px; vertical-align: middle; text-align: center; font-weight: bold; font-size: 14px; line-height: 1.3; color: #222;">${esc(title)}</td></tr>`
    html += `</table>`
    if (cover) html += `<img src="${cover}" alt="${esc(title)}" style="max-height: 230px; max-width: 180px; width: auto; height: auto; border-radius: 4px; object-fit: contain;" />`
    html += `</div>`
  }
  html += `</div>`
  return html
}

function coverUrl(db: ReturnType<typeof serviceClient>, path: string | null | undefined) {
  if (!path) return ''
  return db.storage.from('covers').getPublicUrl(path).data.publicUrl
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
