// request-login-code (TECH-PLAN D2/D3)
// Membership gate for login. Only emails already in the members list may receive
// a login code. Ensures an auth user exists, then the client calls
// supabase.auth.signInWithOtp({ shouldCreateUser: false }) to get the 6-digit code.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/db.ts'

Deno.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf

  try {
    const { email } = await req.json()
    const normalized = String(email ?? '').trim().toLowerCase()
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return json({ ok: false, reason: 'invalid_email' }, 400)
    }

    const db = serviceClient()

    // Gate: must be an existing member.
    const { data: member, error } = await db
      .from('members')
      .select('id')
      .eq('email', normalized)
      .maybeSingle()
    if (error) throw error
    if (!member) {
      return json({ ok: false, reason: 'not_member' })
    }

    // Ensure an auth user exists so signInWithOtp({ shouldCreateUser: false })
    // will deliver a code. Ignore "already registered".
    const { error: createErr } = await db.auth.admin.createUser({
      email: normalized,
      email_confirm: true,
    })
    if (createErr && !/already.*regist|exist/i.test(createErr.message)) {
      throw createErr
    }

    return json({ ok: true })
  } catch (e) {
    console.error('request-login-code:', e)
    return json({ ok: false, reason: 'server_error' }, 500)
  }
})
