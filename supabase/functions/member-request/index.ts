// member-request (TECH-PLAN D3)
// Logged-in members ask the library for an extension or a detail change.
// Emails the admin (best-effort). No tracking table — surfaced via email.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient, userClient } from '../_shared/db.ts'
import { sendEmail } from '../_shared/email.ts'

interface Body {
  type?: 'extension' | 'detail_change'
  loan_ids?: string[]
  message?: string
}

Deno.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf

  try {
    const { data: auth } = await userClient(req).auth.getUser()
    if (!auth?.user) return json({ error: 'Not logged in' }, 401)

    const db = serviceClient()
    const { data: member } = await db
      .from('members')
      .select('id, name, email')
      .eq('auth_user_id', auth.user.id)
      .maybeSingle()
    if (!member) return json({ error: 'No member record' }, 403)

    const body = (await req.json()) as Body

    // Admin recipient + site url.
    const { data: settings } = await db
      .from('settings')
      .select('key, value')
      .in('key', ['admin_notification_email', 'site_url'])
    const map: Record<string, string> = {}
    for (const s of settings ?? []) map[s.key] = String(s.value).replace(/^"|"$/g, '')
    const adminEmail = map.admin_notification_email || member.email

    let subject = ''
    let html = ''

    if (body.type === 'extension') {
      const { data: loans } = await db
        .from('loans')
        .select('due_date, books(title)')
        .in('id', body.loan_ids ?? [])
      const list = (loans ?? [])
        .map((l) => `<li>${(l.books as { title: string } | null)?.title ?? 'book'} (due ${l.due_date})</li>`)
        .join('')
      subject = `Extension request from ${member.name}`
      html = `<p><b>${member.name}</b> (${member.email}) requests an extension on:</p><ul>${list}</ul>`
    } else if (body.type === 'detail_change') {
      subject = `Detail-change request from ${member.name}`
      html = `<p><b>${member.name}</b> (${member.email}) requests a detail change:</p><blockquote>${String(body.message ?? '').replace(/</g, '&lt;')}</blockquote>`
    } else {
      return json({ error: 'Unknown request type' }, 400)
    }

    await sendEmail({ to: adminEmail, replyTo: member.email, subject, html }).catch(
      (e) => console.error('member-request email failed:', e.message),
    )

    return json({ ok: true })
  } catch (e) {
    console.error('member-request:', e)
    return json({ error: (e as Error).message }, 500)
  }
})
