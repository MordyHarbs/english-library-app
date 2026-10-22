import { cn } from '@/lib/utils'
import type { MembershipStatus } from '@/lib/membership'

export function MembershipBadge({
  status,
  className,
}: {
  status: MembershipStatus
  className?: string
}) {
  const { state, daysLeft } = status
  const label =
    state === 'frozen'
      ? 'Frozen'
      : state === 'active'
      ? 'Active'
      : state === 'expiring'
        ? `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
        : state === 'expired'
          ? 'Expired'
          : 'Not paid'
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-xs font-medium',
        state === 'frozen' && 'bg-secondary text-muted-foreground',
        state === 'active' && 'bg-success/15 text-success',
        state === 'expiring' && 'bg-warning/15 text-warning',
        (state === 'expired' || state === 'none') && 'bg-destructive/15 text-destructive',
        className,
      )}
    >
      {label}
    </span>
  )
}
