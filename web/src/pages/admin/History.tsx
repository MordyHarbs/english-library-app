import { useMemo, useState } from 'react'
import { AdminShell } from '@/components/AdminShell'
import { useLoanHistory } from '@/lib/manage'
import { fmtDate } from '@/lib/format'
import { Input } from '@/components/ui/input'

export default function History() {
  const { data: loans, isLoading } = useLoanHistory()
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (loans ?? []).filter(
      (l) => !q || `${l.bookTitle} ${l.memberName}`.toLowerCase().includes(q),
    )
  }, [loans, search])

  return (
    <AdminShell title="Lending history">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search book or member…"
        className="mb-4 sm:max-w-xs"
      />
      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No history yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          {rows.map((l) => (
            <div key={l.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.bookTitle}</p>
                <p className="text-sm text-muted-foreground">{l.memberName}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>Out {fmtDate(l.date_given)}</div>
                <div>Returned {fmtDate(l.date_returned)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
