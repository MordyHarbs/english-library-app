// create-member (TECH-PLAN D3) — admin adds a member and sends a welcome email
// when an email address is provided.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient, requireAdmin } from '../_shared/db.ts'
import { sendEmail } from '../_shared/email.ts'

Deno.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf
  try {
    try {
      await requireAdmin(req)
    } catch (resp) {
      return resp instanceof Response ? resp : json({ error: 'Forbidden' }, 403)
    }

    const body = (await req.json()) as {
      name?: string
      email?: string
      phone?: string
      address?: string
      paid?: boolean
      comments?: string
      is_admin?: boolean
    }
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase() || null
    if (!name) return json({ error: 'Name is required' }, 400)

    const db = serviceClient()
    const { data, error } = await db
      .from('members')
      .insert({
        name,
        email,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        paid: !!body.paid,
        comments: body.comments?.trim() || null,
        is_admin: !!body.is_admin,
      })
      .select('id')
      .single()
    if (error) {
      if (/duplicate|unique/i.test(error.message))
        return json({ error: 'A member with that email already exists' }, 409)
      throw error
    }

    if (email) {
      await sendWelcome(db, name, email).catch((e) =>
        console.error('welcome email failed:', e.message),
      )
    }

    return json({ member_id: data.id })
  } catch (e) {
    console.error('create-member:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

async function sendWelcome(
  db: ReturnType<typeof serviceClient>,
  name: string,
  email: string,
) {
  const { data: toggle } = await db
    .from('settings')
    .select('value')
    .eq('key', 'email_welcome_on_create')
    .maybeSingle()
  if (toggle && toggle.value === false) return

  const { data: s } = await db
    .from('settings')
    .select('value')
    .eq('key', 'site_url')
    .maybeSingle()
  const siteUrl = String(s?.value ?? 'http://localhost:5173').replace(/^"|"$/g, '').replace(/\/$/, '')

  const ok = await sendEmail({
    to: email,
    subject: 'Welcome to Ayalot Library',
    html: `<p>Hi ${name},</p><p>You've been added as a member of Ayalot Library. You can browse the catalog and request books anytime.</p><p>To track your books and requests, <a href="${siteUrl}/login">log in with your email</a> — we'll send you a code. Setting a password is optional.</p><p>Happy reading!</p>`,
  })
  if (ok) await db.from('email_log').insert({ type: 'welcome', recipient: email })
}
