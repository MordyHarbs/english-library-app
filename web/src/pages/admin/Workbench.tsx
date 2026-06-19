import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Search, UserRound, Plus, X } from 'lucide-react'
import { AdminShell } from '@/components/AdminShell'
import { useMembers, useMemberWorkbench, useOpenLoans, useSettings, type Member } from '@/lib/manage'
import { useBooks } from '@/lib/queries'
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

interface LendBooksResult {
  loan_ids?: string[]
  failed?: { book_id: string; reason: string }[]
}

export default function Workbench() {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'member' | 'book'>('member')
  const [busy, setBusy] = useState(false)

  // Shared extend dialog.
  const [extendIds, setExtendIds] = useState<string[] | null>(null)
  const [newDue, setNewDue] = useState(dueDateAfterDays(undefined, DEFAULT_EXTEND_DAYS))

  // --- By member ---
  const { data: members } = useMembers()
  const [memberSearch, setMemberSearch] = useState('')
  const [member, setMember] = useState<Member | null>(null)
  const { data: wb, isLoading } = useMemberWorkbench(member?.id)
  const [holdSel, setHoldSel] = useState<Set<string>>(new Set())
  const [loanSel, setLoanSel] = useState<Set<string>>(new Set())
  const { data: allBooks } = useBooks()
  const [bookSearch, setBookSearch] = useState('')
  const [adHoc, setAdHoc] = useState<{ id: string; title: string }[]>([])

  // --- By book ---
  const { data: openLoans } = useOpenLoans()
  const { data: settings } = useSettings()
  const [loanSearch, setLoanSearch] = useState('')
  const [bookSel, setBookSel] = useState<Set<string>>(new Set())
  const extendDays = defaultExtendDays(settings)

  const memberMatches = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    return (members ?? [])
      .filter((m) => !q || `${m.name} ${m.email}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [members, memberSearch])

  const bookMatches = useMemo(() => {
    const q = bookSearch.trim().toLowerCase()
    if (!q) return []
    return (allBooks ?? [])
      .filter((b) => `${b.title} ${b.author ?? ''}`.toLowerCase().includes(q))
      .filter((b) => !adHoc.some((a) => a.id === b.id))
      .slice(0, 6)
  }, [allBooks, bookSearch, adHoc])

  const loanMatches = useMemo(() => {
    const q = loanSearch.trim().toLowerCase()
    return (openLoans ?? []).filter(
      (l) => !q || `${l.bookTitle} ${l.memberName}`.toLowerCase().includes(q),
    )
  }, [openLoans, loanSearch])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin'] })
    qc.invalidateQueries({ queryKey: ['availability'] })
    qc.invalidateQueries({ queryKey: ['myLoans'] })
    qc.invalidateQueries({ queryKey: ['myReservations'] })
    setHoldSel(new Set())
    setLoanSel(new Set())
    setBookSel(new Set())
    setAdHoc([])
    setBookSearch('')
  }
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const n = new Set(set)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setter(n)
  }

  function openExtendDialog(ids: string[]) {
    const idSet = new Set(ids)
    const latestDueDate = [...(openLoans ?? []), ...(wb?.loans ?? [])]
      .filter((loan) => idSet.has(loan.id))
      .map((loan) => loan.due_date)
      .sort()
      .at(-1)
    setNewDue(dueDateAfterDays(latestDueDate, extendDays))
    setExtendIds(ids)
  }

  async function lendHolds() {
    const items = (wb?.holds ?? [])
      .filter((h) => holdSel.has(h.reservation_item_id))
      .map((h) => ({ book_id: h.book_id, reservation_item_id: h.reservation_item_id }))
    if (items.length === 0) return
    await lendItems(items, `Lent ${items.length} book(s).`)
  }

  async function lendAdHoc() {
    if (adHoc.length === 0) return
    await lendItems(
      adHoc.map((a) => ({ book_id: a.id })),
      `Lent ${adHoc.length} book(s) to ${member!.name}.`,
    )
  }

  async function lendItems(items: { book_id: string; reservation_item_id?: string | null }[], ok: string) {
    setBusy(true)
    try {
      const res = await callFunction<LendBooksResult>('lend-books', { member_id: member!.id, items })
      const failed = res.failed ?? []
      const lent = res.loan_ids?.length ?? items.length - failed.length
      if (lent > 0) toast.success(lent === items.length ? ok : `Lent ${lent} of ${items.length} book(s).`)
      if (failed.length > 0) {
        toast.error(`${failed.length} couldn't be lent: ${failed[0].reason}`)
      }
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function doReturn(ids: string[]) {
    if (ids.length === 0) return
    await run(() => callFunction('return-books', { loan_ids: ids }), `Returned ${ids.length} book(s).`)
  }

  async function doExtend() {
    const ids = extendIds ?? []
    if (ids.length === 0) return
    await run(
      () => callFunction('extend-books', { loan_ids: ids, new_due_date: newDue }),
      `Extended ${ids.length} loan(s) to ${fmtDate(newDue)}.`,
    )
    setExtendIds(null)
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell title="Lend / Return">
      {/* Mode tabs */}
      <div className="mb-5 flex gap-1">
        {(['member', 'book'] as const).map((mo) => (
          <button
            key={mo}
            onClick={() => setMode(mo)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              mode === mo ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60',
            )}
          >
            {mo === 'member' ? 'By member' : 'By book'}
          </button>
        ))}
      </div>

      {/* ============ BY BOOK ============ */}
      {mode === 'book' && (
        <div>
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={loanSearch}
              onChange={(e) => setLoanSearch(e.target.value)}
              placeholder="Search active loans by book or member…"
              className="pl-9"
            />
          </div>
          {loanMatches.length === 0 ? (
            <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
              No matching active loans.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              {loanMatches.map((l) => (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-secondary/30"
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={bookSel.has(l.id)}
                    onChange={() => toggle(bookSel, setBookSel, l.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.bookTitle}</p>
                    <p className="truncate text-sm text-muted-foreground">{l.memberName}</p>
                  </div>
                  <span className={isOverdue(l.due_date, null) ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'}>
                    Due {fmtDate(l.due_date)}
                  </span>
                </label>
              ))}
            </div>
          )}
          {bookSel.size > 0 && (
            <div className="mt-3 flex gap-2">
              <Button disabled={busy} onClick={() => doReturn([...bookSel])}>
                Return ({bookSel.size})
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => openExtendDialog([...bookSel])}>
                Extend ({bookSel.size})
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ============ BY MEMBER ============ */}
      {mode === 'member' &&
        (!member ? (
          <div className="max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search for a member by name or email…"
                className="pl-9"
              />
            </div>
            {memberMatches.length > 0 && (
              <div className="mt-2 max-h-96 divide-y overflow-y-auto rounded-lg border bg-card">
                {memberMatches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMember(m)
                      setMemberSearch('')
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40"
                  >
                    <UserRound className="size-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-sm text-muted-foreground">{m.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-5 flex items-center justify-between rounded-lg border bg-card px-4 py-3">
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setMember(null)}>
                Change member
              </Button>
            </div>

            {/* New lend */}
            <section className="mb-6 rounded-lg border bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold">New lend (book not requested)</h2>
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  placeholder="Search a book to lend…"
                  className="pl-9"
                />
              </div>
              {bookMatches.length > 0 && (
                <div className="mt-2 max-w-md divide-y rounded-md border">
                  {bookMatches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setAdHoc((a) => [...a, { id: b.id, title: b.title }])
                        setBookSearch('')
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary/40"
                    >
                      <span>{b.title}</span>
                      <Plus className="size-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
              {adHoc.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {adHoc.map((a) => (
                    <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm">
                      {a.title}
                      <button onClick={() => setAdHoc((list) => list.filter((x) => x.id !== a.id))}>
                        <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Button className="mt-3" disabled={busy || adHoc.length === 0} onClick={lendAdHoc}>
                Lend {adHoc.length || ''} book(s) now
              </Button>
            </section>

            {isLoading ? (
              <p className="py-8 text-center text-muted-foreground">Loading…</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Holds → lend */}
                <section>
                  <h2 className="mb-2 text-sm font-semibold">Ready to lend (approved holds)</h2>
                  {(wb?.holds ?? []).length === 0 ? (
                    <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">No approved holds.</p>
                  ) : (
                    <div className="rounded-lg border bg-card">
                      {wb!.holds.map((h) => (
                        <label key={h.reservation_item_id} className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={holdSel.has(h.reservation_item_id)}
                            onChange={() => toggle(holdSel, setHoldSel, h.reservation_item_id)}
                          />
                          <span className="font-medium">{h.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <Button className="mt-3" disabled={busy || holdSel.size === 0} onClick={lendHolds}>
                    Lend selected ({holdSel.size})
                  </Button>
                </section>

                {/* Loans → return / extend */}
                <section>
                  <h2 className="mb-2 text-sm font-semibold">Currently borrowed</h2>
                  {(wb?.loans ?? []).length === 0 ? (
                    <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">No books out.</p>
                  ) : (
                    <div className="rounded-lg border bg-card">
                      {wb!.loans.map((l) => (
                        <label key={l.id} className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={loanSel.has(l.id)}
                            onChange={() => toggle(loanSel, setLoanSel, l.id)}
                          />
                          <span className="flex-1 font-medium">{l.bookTitle}</span>
                          <span className={isOverdue(l.due_date, null) ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'}>
                            Due {fmtDate(l.due_date)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {loanSel.size > 0 && (
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" disabled={busy} onClick={() => doReturn([...loanSel])}>
                        Return ({loanSel.size})
                      </Button>
                      <Button variant="outline" disabled={busy} onClick={() => openExtendDialog([...loanSel])}>
                        Extend ({loanSel.size})
                      </Button>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        ))}

      {/* Extend dialog (shared) */}
      <Dialog open={!!extendIds} onOpenChange={(o) => !o && setExtendIds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend {extendIds?.length} loan(s)</DialogTitle>
          </DialogHeader>
          <label className="text-sm font-medium">New due date</label>
          <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExtendIds(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={doExtend}>
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}
