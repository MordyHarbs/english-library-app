// delete-members — admin-only hard delete for member records.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient, requireAdmin } from '../_shared/db.ts'

Deno.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf
  try {
    let admin: { id: string }
    try {
      admin = await requireAdmin(req)
    } catch (resp) {
      const status = resp instanceof Response ? resp.status : 403
      return json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, status)
    }

    const { member_ids } = (await req.json()) as { member_ids: string[] }
    if (!Array.isArray(member_ids) || member_ids.length === 0)
      return json({ error: 'member_ids required' }, 400)
    if (member_ids.includes(admin.id))
      return json({ error: "You can't delete your own admin member record" }, 400)

    const db = serviceClient()

    const { data: members, error: memberError } = await db
      .from('members')
      .select('id, auth_user_id')
      .in('id', member_ids)
    if (memberError) throw memberError

    const { data: loans, error: loanReadError } = await db
      .from('loans')
      .select('id')
      .in('member_id', member_ids)
    if (loanReadError) throw loanReadError

    const loanIds = (loans ?? []).map((loan) => loan.id)
    if (loanIds.length > 0) {
      const { error: detachError } = await db
        .from('reservation_items')
        .update({ loan_id: null })
        .in('loan_id', loanIds)
      if (detachError) throw detachError

      const { error: loanDeleteError } = await db
        .from('loans')
        .delete()
        .in('id', loanIds)
      if (loanDeleteError) throw loanDeleteError
    }

    const { error } = await db.from('members').delete().in('id', member_ids)
    if (error) throw error

    for (const member of members ?? []) {
      if (!member.auth_user_id) continue
      const { error: authError } = await db.auth.admin.deleteUser(member.auth_user_id)
      if (authError) console.error('delete auth user failed:', authError.message)
    }

    return json({ ok: true, deleted: member_ids.length })
  } catch (e) {
    console.error('delete-members:', e)
    return json({ error: (e as Error).message }, 500)
  }
})