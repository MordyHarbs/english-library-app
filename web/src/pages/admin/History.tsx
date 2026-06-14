import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { AdminShell } from '@/components/AdminShell'
import { useLoanHistory } from '@/lib/manage'
import { callFunction } from '@/lib/functions'
import { fmtDate } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function History() {
  const { data: loans, isLoading } = useLoanHistory()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (loans ?? []).filter(
      (l) => !q || `${l.bookTitle} ${l.memberName}`.toLowerCase().includes(q),
    )
  }, [loans, search])

  async function deleteLoan(id: string) {
    if (!window.confirm('Delete this lending history record? This cannot be undone.')) return
    setBusy(true)
    try {
      await callFunction('delete-loans', { loan_ids: [id] })
      toast.success('Lending history record deleted.')
      qc.invalidateQueries({ queryKey: ['admin'] })
      qc.invalidateQueries({ queryKey: ['availability'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

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
              <Button variant="destructive" size="sm" disabled={busy} onClick={() => deleteLoan(l.id)}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
