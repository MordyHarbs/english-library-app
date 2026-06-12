import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { AccountShell } from '@/components/AccountShell'
import { BookThumb } from '@/components/BookThumb'
import { StatusBadge } from '@/components/StatusBadge'
import { useMyReservations } from '@/lib/account'
import { fmtDate } from '@/lib/format'
import { supabase } from '@/lib/supabase'

export default function MyRequests() {
  const { data: reservations, isLoading } = useMyReservations()
  const qc = useQueryClient()

  async function cancelItem(itemId: string) {
    const { error } = await supabase.rpc('cancel_my_item', { item_id: itemId })
    if (error) return toast.error(error.message)
    toast.success('Removed from your request.')
    qc.invalidateQueries({ queryKey: ['myReservations'] })
  }

  return (
    <AccountShell>
      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : (reservations ?? []).length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">You haven't made any requests yet.</p>
          <Link to="/" className="mt-2 inline-block text-sm font-medium underline">
            Browse the catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {reservations!.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-lg border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/40 px-4 py-2.5">
                <span className="text-sm font-medium">
                  Requested {fmtDate(r.created_at)}
                </span>
                {r.pickup_time && (
                  <span className="text-xs text-muted-foreground">
                    Pickup: {r.pickup_time}
                  </span>
                )}
              </div>

              <ul className="divide-y">
                {r.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                    <BookThumb
                      cover_path={it.book?.cover_path ?? null}
                      title={it.book?.title ?? ''}
                      className="h-16 w-11"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-medium leading-snug">
                        {it.book?.title ?? 'Unknown book'}
                      </p>
                      {it.book?.author && (
                        <p className="text-xs text-muted-foreground">{it.book.author}</p>
                      )}
                      <div className="mt-1">
                        <StatusBadge status={it.status} />
                      </div>
                    </div>
                    {it.status === 'pending' && (
                      <button
                        onClick={() => cancelItem(it.id)}
                        className="text-xs font-medium text-muted-foreground underline hover:text-destructive"
                      >
                        Cancel
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {r.admin_note && (
                <div className="border-t bg-secondary/30 px-4 py-2.5 text-sm">
                  <span className="font-medium">Note from the library: </span>
                  {r.admin_note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AccountShell>
  )
}
