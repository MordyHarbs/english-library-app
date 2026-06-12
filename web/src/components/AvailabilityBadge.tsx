import type { Availability } from '@/lib/queries'
import { cn } from '@/lib/utils'

export function AvailabilityBadge({
  availability,
  className,
}: {
  availability: Availability | undefined
  className?: string
}) {
  const available = availability?.is_available ?? true
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        available
          ? 'bg-success/12 text-success'
          : 'bg-warning/15 text-warning',
        className,
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          available ? 'bg-success' : 'bg-warning',
        )}
      />
      {available
        ? 'Available'
        : availability?.expected_return
          ? `Out · back ${availability.expected_return}`
          : 'Checked out'}
    </span>
  )
}
