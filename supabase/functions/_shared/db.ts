// Service-role Supabase client for Edge Functions. Bypasses RLS — only ever
// used server-side. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected
// automatically into the Edge runtime.
import { createClient } from 'jsr:@supabase/supabase-js@2'

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

// A client scoped to the caller's JWT, so we can read who they are and let RLS
// apply. Used by admin-only functions together with an is_admin() check.
export function userClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    },
  )
}

// Verifies the caller is a logged-in admin. Returns the member row or throws.
export async function requireAdmin(req: Request) {
  const uc = userClient(req)
  const { data: auth } = await uc.auth.getUser()
  if (!auth?.user) throw new Response('Unauthorized', { status: 401 })
  const svc = serviceClient()
  const { data: member } = await svc
    .from('members')
    .select('id, is_admin, name, email')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle()
  if (!member?.is_admin) throw new Response('Forbidden', { status: 403 })
  return member
}
