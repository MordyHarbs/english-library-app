// delete-loans — admin-only hard delete for lending records.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient, requireAdmin } from '../_shared/db.ts'

Deno.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf
  try {
    try {
      await requireAdmin(req)
    } catch (resp) {
      return resp instanceof Response ? resp : json({ error: 'Forbidden' }, 403)
    }

    const { loan_ids } = (await req.json()) as { loan_ids: string[] }
    if (!Array.isArray(loan_ids) || loan_ids.length === 0)
      return json({ error: 'loan_ids required' }, 400)

    const db = serviceClient()

    await db
      .from('reservation_items')
      .update({ loan_id: null })
      .in('loan_id', loan_ids)

    const { error } = await db.from('loans').delete().in('id', loan_ids)
    if (error) throw error

    return json({ ok: true, deleted: loan_ids.length })
  } catch (e) {
    console.error('delete-loans:', e)
    return json({ error: (e as Error).message }, 500)
  }
})