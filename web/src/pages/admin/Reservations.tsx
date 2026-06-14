import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { AdminShell } from '@/components/AdminShell'
import { StatusBadge } from '@/components/StatusBadge'
import { useReservationsQueue } from '@/lib/admin'
import { callFunction } from '@/lib/functions'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export default function Reservations() {
  const { data: queue, isLoading } = useReservationsQueue()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [busy, setBusy] = useState<string | null>(null)
  const navigate = useNavigate()

  const rows = (queue ?? []).filter((r) => (tab === 'pending' ? r.pendingCount > 0 : true))

  async function deleteReservation(id: string, name: string) {
    if (!window.confirm(`Delete ${name}'s reservation? This cannot be undone.`)) return
    setBusy(id)
    try {
      await callFunction('delete-reservations', { reservation_ids: [id] })
      toast.success('Reservation deleted.')
      qc.invalidateQueries({ queryKey: ['admin'] })
      qc.invalidateQueries({ queryKey: ['myReservations'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <AdminShell title="Reservations">
      <div className="mb-4 flex gap-1">
        {(['pending', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/60',
            )}
          >
            {t === 'pending' ? 'Needs review' : 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          {tab === 'pending' ? 'Nothing waiting to review.' : 'No reservations yet.'}
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/40"
            >
              <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/admin/reservations/${r.id}`)}>
                <p className="font-medium">
                  {r.name}{' '}
                  {!r.member_id && (
                    <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning">
                      new / non-member
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {r.items.length} book{r.items.length === 1 ? '' : 's'} ·{' '}
                  {fmtDate(r.created_at)}
                  {r.pickup_time ? ` · pickup ${r.pickup_time}` : ''}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                {r.pendingCount > 0 ? (
                  <StatusBadge status="pending" />
                ) : (
                  <span className="text-xs text-muted-foreground">Reviewed</span>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy === r.id}
                  onClick={() => deleteReservation(r.id, r.name)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
