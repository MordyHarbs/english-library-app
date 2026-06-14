import { Link } from 'react-router-dom'
import { Inbox, BookCopy, AlertTriangle, Clock } from 'lucide-react'
import { AdminShell } from '@/components/AdminShell'
import { useAdminOverview, useReservationsQueue } from '@/lib/admin'
import { fmtDate } from '@/lib/format'

function StatCard({
  to,
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  to: string
  label: string
  value: number | undefined
  icon: typeof Inbox
  tone?: 'default' | 'warning' | 'danger'
}) {
  const toneCls =
    tone === 'danger'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-foreground'
  return (
    <Link
      to={to}
      className="rounded-lg border bg-card p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className={`mt-2 text-3xl font-medium ${toneCls}`}>{value ?? '—'}</div>
    </Link>
  )
}

export default function AdminOverview() {
  const { data: stats } = useAdminOverview()
  const { data: queue } = useReservationsQueue()
  const pendingReservations = (queue ?? []).filter((r) => r.pendingCount > 0).slice(0, 6)

  return (
    <AdminShell title="Overview">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard to="/admin/reservations" label="Pending items" value={stats?.pending} icon={Inbox} />
        <StatCard to="/admin/loans" label="Books out" value={stats?.out} icon={BookCopy} />
        <StatCard
          to="/admin/loans?filter=overdue"
          label="Overdue"
          value={stats?.overdue}
          icon={AlertTriangle}
          tone="danger"
        />
        <StatCard
          to="/admin/loans?filter=due_soon"
          label="Due soon"
          value={stats?.dueSoon}
          icon={Clock}
          tone="warning"
        />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Reservations to review</h2>
          <Link to="/admin/reservations" className="text-sm font-medium underline">
            View all
          </Link>
        </div>
        {pendingReservations.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
            Nothing waiting — you're all caught up.
          </div>
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {pendingReservations.map((r) => (
              <Link
                key={r.id}
                to={`/admin/reservations/${r.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/40"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.name}{' '}
                    {!r.member_id && (
                      <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning">
                        new
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {r.pendingCount} book{r.pendingCount === 1 ? '' : 's'} · {fmtDate(r.created_at)}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">Review →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  )
}
