import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useState } from 'react'
import { AccountShell } from '@/components/AccountShell'
import { BookThumb } from '@/components/BookThumb'
import { StatusBadge } from '@/components/StatusBadge'
import { useMyLoans } from '@/lib/account'
import { fmtDate, isOverdue } from '@/lib/format'
import { callFunction } from '@/lib/functions'
import { Button } from '@/components/ui/button'

export default function MyBooks() {
  const { data: loans, isLoading } = useMyLoans()
  const [requesting, setRequesting] = useState<string | null>(null)
  const open = (loans ?? []).filter((l) => !l.date_returned)

  async function requestExtension(loanId: string) {
    setRequesting(loanId)
    try {
      await callFunction('member-request', { type: 'extension', loan_ids: [loanId] })
      toast.success('Extension request sent to the library.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRequesting(null)
    }
  }

  return (
    <AccountShell>
      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : open.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">You have no books out right now.</p>
          <Link to="/" className="mt-2 inline-block text-sm font-medium underline">
            Browse the catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {open.map((l) => {
            const overdue = isOverdue(l.due_date, l.date_returned)
            return (
              <div
                key={l.id}
                className="flex items-center gap-4 rounded-lg border bg-card p-3"
              >
                <BookThumb cover_path={l.book?.cover_path ?? null} title={l.book?.title ?? ''} />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-medium leading-snug">
                    {l.book?.title ?? 'Unknown book'}
                  </p>
                  {l.book?.author && (
                    <p className="text-sm text-muted-foreground">{l.book.author}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusBadge status={overdue ? 'overdue' : 'on_loan'} />
                    <span className="text-xs text-muted-foreground">
                      Due {fmtDate(l.due_date)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={requesting === l.id}
                  onClick={() => requestExtension(l.id)}
                >
                  {requesting === l.id ? 'Sending…' : 'Request extension'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </AccountShell>
  )
}
