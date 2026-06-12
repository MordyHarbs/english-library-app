import { AccountShell } from '@/components/AccountShell'
import { BookThumb } from '@/components/BookThumb'
import { useMyLoans } from '@/lib/account'
import { fmtDate } from '@/lib/format'

export default function MyHistory() {
  const { data: loans, isLoading } = useMyLoans()
  const history = (loans ?? [])
    .filter((l) => l.date_returned)
    .sort((a, b) => (a.date_returned! < b.date_returned! ? 1 : -1))

  return (
    <AccountShell>
      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : history.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Nothing in your history yet.
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              <BookThumb
                cover_path={l.book?.cover_path ?? null}
                title={l.book?.title ?? ''}
                className="h-14 w-10"
              />
              <div className="min-w-0 flex-1">
                <p className="font-display font-medium leading-snug">
                  {l.book?.title ?? 'Unknown book'}
                </p>
                {l.book?.author && (
                  <p className="text-xs text-muted-foreground">{l.book.author}</p>
                )}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>Borrowed {fmtDate(l.date_given)}</div>
                <div>Returned {fmtDate(l.date_returned)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AccountShell>
  )
}
