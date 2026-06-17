// submit-reservation (TECH-PLAN D2/D3)
// Public endpoint. Creates a reservation + per-book items, links a member by
// session or email, then best-effort emails the admin (with a deep link) and
// the requester. Email never blocks the reservation.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient, userClient } from '../_shared/db.ts'
import { sendEmail } from '../_shared/email.ts'

interface Body {
  name?: string
  email?: string
  phone?: string
  address?: string
  pickup_time?: string
  comments?: string
  book_ids?: string[]
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const cleanText = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()

Deno.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf

  try {
    const body = (await req.json()) as Body
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const bookIds = Array.isArray(body.book_ids) ? body.book_ids : []

    if (!name) return json({ error: 'Name is required' }, 400)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ error: 'A valid email is required' }, 400)
    if (bookIds.length === 0) return json({ error: 'No books selected' }, 400)

    const db = serviceClient()

    // Enforce max-book limit server-side.
    const { data: maxRow } = await db
      .from('settings')
      .select('value')
      .eq('key', 'max_book_limit')
      .maybeSingle()
    const maxBooks = Number(maxRow?.value ?? 10)
    if (bookIds.length > maxBooks)
      return json({ error: `Please request no more than ${maxBooks} books` }, 400)

    // Resolve member: prefer the logged-in session, else match by email.
    let memberId: string | null = null
    let isMember = false
    const authHeader = req.headers.get('Authorization')
    if (authHeader && authHeader !== 'Bearer ' + Deno.env.get('SUPABASE_ANON_KEY')) {
      const { data: auth } = await userClient(req).auth.getUser()
      if (auth?.user) {
        const { data: m } = await db
          .from('members')
          .select('id')
          .eq('auth_user_id', auth.user.id)
          .maybeSingle()
        if (m) {
          memberId = m.id
          isMember = true
        }
      }
    }
    if (!memberId) {
      const { data: m } = await db
        .from('members')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      if (m) {
        memberId = m.id
        isMember = true
      }
    }

    // Create reservation + items.
    const { data: reservation, error: resErr } = await db
      .from('reservations')
      .insert({
        member_id: memberId,
        name,
        email,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        pickup_time: body.pickup_time?.trim() || null,
        comments: body.comments?.trim() || null,
      })
      .select('id')
      .single()
    if (resErr) throw resErr

    const { error: itemsErr } = await db
      .from('reservation_items')
      .insert(bookIds.map((book_id) => ({ reservation_id: reservation.id, book_id })))
    if (itemsErr) throw itemsErr

    // Fire emails (best-effort).
    await sendEmails(db, reservation.id, { name, email, isMember, body, bookIds }).catch(
      (e) => console.error('email step failed:', e.message),
    )

    return json({ reservation_id: reservation.id })
  } catch (e) {
    console.error('submit-reservation:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

async function sendEmails(
  db: ReturnType<typeof serviceClient>,
  reservationId: string,
  ctx: { name: string; email: string; isMember: boolean; body: Body; bookIds: string[] },
) {
  // Settings: admin recipient + site url.
  const { data: settings } = await db
    .from('settings')
    .select('key, value')
    .in('key', ['admin_notification_email', 'site_url'])
  const map: Record<string, string> = {}
  for (const s of settings ?? []) map[s.key] = String(s.value).replace(/^"|"$/g, '')
  const adminEmail = map.admin_notification_email || ctx.email
  const siteUrl = (map.site_url || 'http://localhost:5173').replace(/\/$/, '')

  // Book titles + availability for the email.
  const { data: books } = await db
    .from('books')
    .select('id, title, author, cover_path')
    .in('id', ctx.bookIds)
  const { data: avail } = await db
    .from('book_availability')
    .select('book_id, is_available, expected_return')
    .in('book_id', ctx.bookIds)
  const availMap = new Map((avail ?? []).map((a) => [a.book_id, a]))

  const bookList = (books ?? [])
    .map((b) => {
      const a = availMap.get(b.id)
      const out = a && !a.is_available
      const tag = out
        ? ` — <b style="color:#b45309">not currently available${a?.expected_return ? ` (back ${a.expected_return})` : ''}</b>`
        : ''
      return `<li>${esc(b.title)}${b.author ? ` <span style="color:#666">by ${esc(b.author)}</span>` : ''}${tag}</li>`
    })
    .join('')

  let bookCards = `<div style="text-align: center; margin: 20px 0;">`
  for (const book of books ?? []) {
    const a = availMap.get(book.id)
    const out = a && !a.is_available
    const cover = coverUrl(db, book.cover_path)
    bookCards += `<div style="margin: 16px 8px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; display: inline-block; width: 200px; height: 320px; vertical-align: top; text-align: center; overflow: hidden; background-color: #fafafa;">`
    bookCards += `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">`
    bookCards += `<tr><td height="52" align="center" valign="middle" style="height: 52px; vertical-align: middle; text-align: center; font-weight: bold; font-size: 14px; line-height: 1.3; color: #222;">${esc(book.title)}</td></tr>`
    bookCards += `</table>`
    if (cover) {
      bookCards += `<img src="${cover}" alt="${esc(book.title)}" style="max-height: 230px; max-width: 180px; width: auto; height: auto; border-radius: 4px; object-fit: contain;" />`
    }
    if (out) {
      const ret = a?.expected_return ? ` (expected ${a.expected_return})` : ''
      bookCards += `<div style="margin-top: 8px; font-size: 12px; color: #92400e; background: #fef3c7; padding: 3px 8px; border-radius: 6px; font-weight: 600;">⚠ Not available${esc(ret)}</div>`
    }
    bookCards += `</div>`
  }
  bookCards += `</div>`

  // --- Admin alert ---
  const adminHtml = `
    <p>New book hold request received from the website:</p>
    <table style="border-collapse: collapse; margin-bottom: 16px;">
      <tr><td style="padding: 4px 8px;"><b>From:</b></td><td>${esc(ctx.name)}</td></tr>
      <tr><td style="padding: 4px 8px;"><b>Email:</b></td><td><a href="mailto:${esc(ctx.email)}">${esc(ctx.email)}</a></td></tr>
      <tr><td style="padding: 4px 8px;"><b>Expected pickup:</b></td><td>${esc(ctx.body.pickup_time || 'Not specified')}</td></tr>
    </table>
    ${
      ctx.isMember
        ? ''
        : `<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px;">
             <b>⚠ NEW / NON-MEMBER</b> — email not found in member list<br>
             Phone: ${esc(ctx.body.phone || 'Not provided')}<br>
             Address: ${esc(ctx.body.address || 'Not provided')}
           </div>`
    }
    <p><b>Books requested (${ctx.bookIds.length}):</b></p>
    ${bookCards}
    ${ctx.body.comments ? `<p><b>Notes from requester:</b><br>${esc(ctx.body.comments)}</p>` : ''}
    <hr style="border: none; border-top: 1px solid #ccc; margin-top: 24px;">
    <p style="color: #888; font-size: 12px;">Reply directly to this email to confirm the hold with the requester.</p>`
  const adminOk = await sendEmail({
    to: adminEmail,
    replyTo: ctx.email,
    subject: `Book Hold Request from ${cleanText(ctx.name)}${ctx.isMember ? '' : ' (NEW MEMBER)'}`,
    html: adminHtml,
  })
  if (adminOk)
    await db.from('email_log').insert({
      type: 'admin_new_reservation',
      recipient: adminEmail,
      reservation_id: reservationId,
    })

  // --- Requester confirmation ---
  const reqHtml = `
    <p>Hi ${esc(ctx.name)},</p>
    <p>We received your request for:</p>
    <ul>${bookList}</ul>
    <p>The library will review it and email you to confirm pickup.</p>
    ${!ctx.isMember ? `<p style="color:#666">Tip: if you're a member, you can <a href="${siteUrl}/login">log in</a> to track your requests — it's optional.</p>` : ''}`
  const reqOk = await sendEmail({
    to: ctx.email,
    subject: 'Your Ayalot Library request',
    html: reqHtml,
  })
  if (reqOk)
    await db.from('email_log').insert({
      type: 'reservation_received',
      recipient: ctx.email,
      reservation_id: reservationId,
    })
}

function coverUrl(db: ReturnType<typeof serviceClient>, path: string | null | undefined) {
  if (!path) return ''
  return db.storage.from('covers').getPublicUrl(path).data.publicUrl
}
