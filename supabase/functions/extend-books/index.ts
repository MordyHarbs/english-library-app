// extend-books (TECH-PLAN D3) — admin sets a new due date on open loans.
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

    const { loan_ids, new_due_date } = (await req.json()) as {
      loan_ids: string[]
      new_due_date: string
    }
    if (!Array.isArray(loan_ids) || loan_ids.length === 0 || !new_due_date)
      return json({ error: 'loan_ids and new_due_date required' }, 400)

    const db = serviceClient()
    const { error } = await db
      .from('loans')
      .update({ due_date: new_due_date })
      .in('id', loan_ids)
      .is('date_returned', null)
    if (error) throw error

    return json({ ok: true })
  } catch (e) {
    console.error('extend-books:', e)
    return json({ error: (e as Error).message }, 500)
  }
})
