import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { AccountShell } from '@/components/AccountShell'
import { BookThumb } from '@/components/BookThumb'
import { BookDialog } from '@/components/BookDialog'
import { StatusBadge, type Status } from '@/components/StatusBadge'
import { useMyReservations, type MyReservationItem } from '@/lib/account'
import { fmtDate } from '@/lib/format'
import { supabase } from '@/lib/supabase'

function requestStatus(item: MyReservationItem): Status {
  if (item.status === 'fulfilled' && item.date_returned) return 'returned'
  return item.status
}

function isActiveRequestItem(item: MyReservationItem) {
  return ['pending', 'approved', 'fulfilled'].includes(requestStatus(item))
}

export default function MyRequests() {
  const { data: reservations, isLoading } = useMyReservations()
  const qc = useQueryClient()
  const [openBook, setOpenBook] = useState<string | null>(null)
  const [activeOnly, setActiveOnly] = useState(false)

  const visibleReservations = useMemo(() => {
    return (reservations ?? [])
      .map((r) => ({
        ...r,
        items: activeOnly ? r.items.filter(isActiveRequestItem) : r.items,
      }))
      .filter((r) => r.items.length > 0)
  }, [activeOnly, reservations])

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
      ) : visibleReservations.length === 0 ? (
        <div className="space-y-4">
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Show only active requests
          </label>
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">You have no active requests right now.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Show only active requests
          </label>

          {visibleReservations.map((r) => (
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
                      <button
                        onClick={() => setOpenBook(it.book_id)}
                        className="font-display text-left font-medium leading-snug hover:underline"
                      >
                        {it.book?.title ?? 'Unknown book'}
                      </button>
                      {it.book?.author && (
                        <p className="text-xs text-muted-foreground">{it.book.author}</p>
                      )}
                      <div className="mt-1">
                        <StatusBadge status={requestStatus(it)} />
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

      <BookDialog bookId={openBook} onClose={() => setOpenBook(null)} allowAdd={false} />
    </AccountShell>
  )
}
