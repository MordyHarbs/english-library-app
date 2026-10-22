import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Availability } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Admin-only popup: who currently has this book out. */
function BorrowerDialog({
  bookId,
  title,
  open,
  onClose,
}: {
  bookId: string
  title?: string
  open: boolean
  onClose: () => void
}) {
  const { data: loan, isLoading } = useQuery({
    enabled: open,
    queryKey: ['admin', 'bookBorrower', bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loans')
        .select('due_date, members(name)')
        .eq('book_id', bookId)
        .is('date_returned', null)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
  const member = (loan?.members as { name: string } | null)?.name
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">{title ?? 'Book'}</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          {isLoading ? (
            'Loading…'
          ) : loan ? (
            <>
              Currently borrowed by <span className="font-medium">{member ?? 'Unknown'}</span>
              <br />
              Due {fmtDate(loan.due_date)}
            </>
          ) : (
            'No open loan found.'
          )}
        </p>
      </DialogContent>
    </Dialog>
  )
}

export function AvailabilityBadge({
  availability,
  className,
  bookId,
  title,
}: {
  availability: Availability | undefined
  className?: string
  /** When given, admins can click an "Out" badge to see who has the book. */
  bookId?: string
  title?: string
}) {
  const { isAdmin } = useAuth()
  const [showBorrower, setShowBorrower] = useState(false)
  const available = availability?.is_available ?? true
  if (availability?.is_unavailable) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground',
          className,
        )}
      >
        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
        Unavailable
      </span>
    )
  }
  const canSeeBorrower = isAdmin && !!bookId && !available && !availability?.is_reserved
  const Tag = canSeeBorrower ? 'button' : 'span'
  return (
    <>
      <Tag
        {...(canSeeBorrower
          ? {
              type: 'button' as const,
              onClick: () => setShowBorrower(true),
              title: 'Who has it?',
            }
          : {})}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
          available ? 'bg-success/12 text-success' : 'bg-warning/15 text-warning',
          canSeeBorrower && 'cursor-pointer hover:brightness-95',
          className,
        )}
      >
        <span className={cn('size-1.5 rounded-full', available ? 'bg-success' : 'bg-warning')} />
        {available
          ? 'Available'
          : availability?.is_reserved
            ? 'Reserved'
            : availability?.expected_return
              ? `Out · back ${availability.expected_return}`
              : 'Checked out'}
      </Tag>
      {canSeeBorrower && (
        <BorrowerDialog
          bookId={bookId!}
          title={title}
          open={showBorrower}
          onClose={() => setShowBorrower(false)}
        />
      )}
    </>
  )
}
