import { cn } from '@/lib/utils'

// Covers reservation-item statuses plus derived loan states.
export type Status =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'fulfilled'
  | 'on_loan'
  | 'overdue'
  | 'returned'

const MAP: Record<Status, { label: string; cls: string }> = {
  pending: { label: 'Pending review', cls: 'bg-secondary text-secondary-foreground' },
  approved: { label: 'Approved · ready for pickup', cls: 'bg-success/12 text-success' },
  rejected: { label: 'Not available', cls: 'bg-destructive/12 text-destructive' },
  cancelled: { label: 'Cancelled', cls: 'bg-muted text-muted-foreground' },
  fulfilled: { label: 'Picked up', cls: 'bg-accent/15 text-accent' },
  on_loan: { label: 'On loan', cls: 'bg-secondary text-secondary-foreground' },
  overdue: { label: 'Overdue', cls: 'bg-warning/15 text-warning' },
  returned: { label: 'Returned', cls: 'bg-muted text-muted-foreground' },
}

export function StatusBadge({
  status,
  className,
}: {
  status: Status
  className?: string
}) {
  const s = MAP[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        s.cls,
        className,
      )}
    >
      {s.label}
    </span>
  )
}
