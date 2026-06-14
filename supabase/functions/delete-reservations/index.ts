// delete-reservations — admin-only hard delete for reservation records.
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

    const { reservation_ids } = (await req.json()) as { reservation_ids: string[] }
    if (!Array.isArray(reservation_ids) || reservation_ids.length === 0)
      return json({ error: 'reservation_ids required' }, 400)

    const db = serviceClient()

    const { data: items, error: itemError } = await db
      .from('reservation_items')
      .select('id')
      .in('reservation_id', reservation_ids)
    if (itemError) throw itemError

    const itemIds = (items ?? []).map((item) => item.id)
    if (itemIds.length > 0) {
      const { error: loanError } = await db
        .from('loans')
        .update({ reservation_item_id: null })
        .in('reservation_item_id', itemIds)
      if (loanError) throw loanError
    }

    const { error } = await db.from('reservations').delete().in('id', reservation_ids)
    if (error) throw error

    return json({ ok: true, deleted: reservation_ids.length })
  } catch (e) {
    console.error('delete-reservations:', e)
    return json({ error: (e as Error).message }, 500)
  }
})