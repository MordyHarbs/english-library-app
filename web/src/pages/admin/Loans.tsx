import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { AdminShell } from '@/components/AdminShell'
import { useOpenLoans, useSettings, type AdminLoan } from '@/lib/manage'
import { callFunction } from '@/lib/functions'
import { fmtDate, isOverdue } from '@/lib/format'
import { DEFAULT_EXTEND_DAYS, defaultExtendDays, dueDateAfterDays } from '@/lib/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { addDays, format } from 'date-fns'

type Filter = 'all' | 'overdue' | 'due_soon'

export default function Loans() {
  const { data: loans, isLoading } = useOpenLoans()
  const { data: settings } = useSettings()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const initialFilter = searchParams.get('filter')
  const [filter, setFilter] = useState<Filter>(
    initialFilter === 'overdue' || initialFilter === 'due_soon' ? initialFilter : 'all',
  )
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [extendOpen, setExtendOpen] = useState(false)
  const [newDue, setNewDue] = useState(dueDateAfterDays(undefined, DEFAULT_EXTEND_DAYS))
  const [busy, setBusy] = useState(false)
  const extendDays = defaultExtendDays(settings)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const soon = format(addDays(new Date(), 3), 'yyyy-MM-dd')
    const today = format(new Date(), 'yyyy-MM-dd')
    return (loans ?? []).filter((l) => {
      if (filter === 'overdue' && !isOverdue(l.due_date, null)) return false
      if (filter === 'due_soon' && !(l.due_date >= today && l.due_date <= soon)) return false
      if (q && !`${l.bookTitle} ${l.memberName}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [loans, filter, search])

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const ids = [...selected]
  const defaultNewDue = dueDateAfterDays(
    (loans ?? [])
      .filter((loan) => selected.has(loan.id))
      .map((loan) => loan.due_date)
      .sort()
      .at(-1),
    extendDays,
  )

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin'] })
    qc.invalidateQueries({ queryKey: ['availability'] })
    setSelected(new Set())
  }

  async function returnSelected() {
    setBusy(true)
    try {
      const res = await callFunction<{ waiting_holds: { requester: string | null }[] }>(
        'return-books',
        { loan_ids: ids },
      )
      const waiting = res.waiting_holds?.filter((w) => w.requester) ?? []
      toast.success(`Returned ${ids.length} book${ids.length === 1 ? '' : 's'}.`)
      if (waiting.length)
        toast.info(`${waiting.length} waiting hold(s) on returned books — check Reservations.`)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function extendSelected() {
    setBusy(true)
    try {
      await callFunction('extend-books', { loan_ids: ids, new_due_date: newDue })
      toast.success(`Extended ${ids.length} loan${ids.length === 1 ? '' : 's'} to ${fmtDate(newDue)}.`)
      setExtendOpen(false)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteSelected() {
    if (!window.confirm(`Delete ${ids.length} lending record${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await callFunction('delete-loans', { loan_ids: ids })
      toast.success(`Deleted ${ids.length} lending record${ids.length === 1 ? '' : 's'}.`)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell title="Open loans">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1">
          {(['all', 'overdue', 'due_soon'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                filter === f ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60',
              )}
            >
              {f === 'all' ? 'All' : f === 'overdue' ? 'Overdue' : 'Due soon'}
            </button>
          ))}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search book or member…"
          className="sm:max-w-xs"
        />
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No loans match.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          {rows.map((l: AdminLoan) => {
            const overdue = isOverdue(l.due_date, null)
            return (
              <label
                key={l.id}
                className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-secondary/30"
              >
                <input
                  type="checkbox"
                  checked={selected.has(l.id)}
                  onChange={() => toggle(l.id)}
                  className="size-4"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{l.bookTitle}</p>
                  <p className="text-sm text-muted-foreground">{l.memberName}</p>
                </div>
                <span className={cn('text-sm', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                  {overdue ? 'Overdue · ' : 'Due '}
                  {fmtDate(l.due_date)}
                </span>
              </label>
            )
          })}
        </div>
      )}

      {/* Sticky bulk action bar */}
      {ids.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 py-3 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <span className="text-sm font-medium">{ids.length} selected</span>
            <div className="flex gap-2">
              <Button variant="destructive" disabled={busy} onClick={deleteSelected}>
                Delete
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => {
                setNewDue(defaultNewDue)
                setExtendOpen(true)
              }}>
                Extend
              </Button>
              <Button disabled={busy} onClick={returnSelected}>
                Return
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend {ids.length} loan(s)</DialogTitle>
          </DialogHeader>
          <label className="text-sm font-medium">New due date</label>
          <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExtendOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={extendSelected}>
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}
