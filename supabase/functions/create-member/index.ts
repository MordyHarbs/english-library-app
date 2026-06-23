// create-member (TECH-PLAN D3) — admin adds a member and sends a welcome email
// when an email address is provided.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient, requireAdmin } from '../_shared/db.ts'
import { sendEmail } from '../_shared/email.ts'
import { loadBranding } from '../_shared/branding.ts'

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

  const { data: settings } = await db
    .from('settings')
    .select('key, value')
    .in('key', ['site_url', 'default_book_limit', 'loan_duration_days', 'default_extend_days', 'late_fee_per_week'])
  const branding = await loadBranding(db)
  const map: Record<string, unknown> = {}
  for (const s of settings ?? []) map[s.key] = s.value
  const siteUrl = branding.siteUrl
  const maxBooks = Number(map.default_book_limit ?? 3)
  const durationText = formatDays(Number(map.loan_duration_days ?? 21), false)
  const lateFee = Number(map.late_fee_per_week ?? 5) || 5
  const extendText = formatDays(Number(map.default_extend_days ?? 7), true)
  const displayName = name || 'New Member'

  const text = `Hello ${displayName},\n\nWelcome to ${branding.libraryName}! We're excited to have you as a member.\n\nYou can browse our catalog online at ${siteUrl}.\n\nHappy reading!`

  const html = `<b>Hello ${esc(displayName)},<br><br>` +
    `Welcome to ${esc(branding.libraryName)}! We're excited to have you as a member.<br><br>` +
    `You can browse our catalog online at <a href="${siteUrl}">${esc(branding.libraryName)}</a>.</b><br><br><br>` +
    `* You can take up to ${maxBooks} books at a time<br><br>` +
    `* Please return the books within ${durationText}, if it isn't enough time for you - please contact us and you can extend for up to ${extendText} at a time.<br><br>` +
    `* If returned late without contacting us - there will be a charge of ${lateFee} shekel per week.<br><br><br>` +
    `<b>Happy reading!</b><br><br>` +
    `P.S. This is an automatic email. <br><br>` +
    `<img src="${branding.logoUrl}" alt="${esc(branding.libraryName)} Logo" style="max-width:200px;">`

  const ok = await sendEmail({
    to: email,
    fromName: branding.libraryName,
    subject: `Welcome to ${branding.libraryName}!`,
    text,
    html,
  })
  if (ok) await db.from('email_log').insert({ type: 'welcome', recipient: email })
}

function formatDays(days: number, isExtend: boolean) {
  if (days % 7 === 0) {
    const weeks = days / 7
    if (weeks === 1) return isExtend ? 'a week' : '1 week'
    return `${weeks} weeks`
  }
  return `${days} days`
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
