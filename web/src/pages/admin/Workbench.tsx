import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Search, UserRound, Plus, X } from 'lucide-react'
import { AdminShell } from '@/components/AdminShell'
import { useMembers, useMemberWorkbench, type Member } from '@/lib/manage'
import { useBooks } from '@/lib/queries'
import { callFunction } from '@/lib/functions'
import { fmtDate, isOverdue } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Workbench() {
  const { data: members } = useMembers()
  const [memberSearch, setMemberSearch] = useState('')
  const [member, setMember] = useState<Member | null>(null)
  const { data: wb, isLoading } = useMemberWorkbench(member?.id)
  const qc = useQueryClient()

  const [holdSel, setHoldSel] = useState<Set<string>>(new Set())
  const [loanSel, setLoanSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // Ad-hoc "new lend" (no prior request).
  const { data: allBooks } = useBooks()
  const [bookSearch, setBookSearch] = useState('')
  const [adHoc, setAdHoc] = useState<{ id: string; title: string }[]>([])
  const bookMatches = useMemo(() => {
    const q = bookSearch.trim().toLowerCase()
    if (!q) return []
    return (allBooks ?? [])
      .filter((b) => `${b.title} ${b.author ?? ''}`.toLowerCase().includes(q))
      .filter((b) => !adHoc.some((a) => a.id === b.id))
      .slice(0, 6)
  }, [allBooks, bookSearch, adHoc])

  const matches = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return []
    return (members ?? [])
      .filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(q))
      .slice(0, 6)
  }, [members, memberSearch])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin'] })
    qc.invalidateQueries({ queryKey: ['availability'] })
    setHoldSel(new Set())
    setLoanSel(new Set())
    setAdHoc([])
    setBookSearch('')
  }
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const n = new Set(set)
    n.has(id) ? n.delete(id) : n.add(id)
    setter(n)
  }

  async function lend() {
    const items = (wb?.holds ?? [])
      .filter((h) => holdSel.has(h.reservation_item_id))
      .map((h) => ({ book_id: h.book_id, reservation_item_id: h.reservation_item_id }))
    if (items.length === 0) return
    setBusy(true)
    try {
      await callFunction('lend-books', { member_id: member!.id, items })
      toast.success(`Lent ${items.length} book(s) to ${member!.name}.`)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function lendAdHoc() {
    if (adHoc.length === 0) return
    setBusy(true)
    try {
      const res = await callFunction<{ failed: { book_id: string }[] }>('lend-books', {
        member_id: member!.id,
        items: adHoc.map((a) => ({ book_id: a.id })),
      })
      const failed = res.failed?.length ?? 0
      toast.success(`Lent ${adHoc.length - failed} book(s) to ${member!.name}.`)
      if (failed) toast.error(`${failed} couldn't be lent (already out).`)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function returnLoans() {
    const loan_ids = [...loanSel]
    if (loan_ids.length === 0) return
    setBusy(true)
    try {
      await callFunction('return-books', { loan_ids })
      toast.success(`Returned ${loan_ids.length} book(s).`)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell title="Lend / Return">
      {/* Member picker */}
      {!member ? (
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
          {matches.length > 0 && (
            <div className="mt-2 divide-y rounded-lg border bg-card">
              {matches.map((m) => (
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

          {/* New lend (no prior request) */}
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
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm"
                  >
                    {a.title}
                    <button
                      onClick={() => setAdHoc((list) => list.filter((x) => x.id !== a.id))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
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
              {/* Approved holds → lend */}
              <section>
                <h2 className="mb-2 text-sm font-semibold">Ready to lend (approved holds)</h2>
                {(wb?.holds ?? []).length === 0 ? (
                  <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                    No approved holds.
                  </p>
                ) : (
                  <div className="rounded-lg border bg-card">
                    {wb!.holds.map((h) => (
                      <label
                        key={h.reservation_item_id}
                        className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0"
                      >
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
                <Button className="mt-3" disabled={busy || holdSel.size === 0} onClick={lend}>
                  Lend selected ({holdSel.size})
                </Button>
              </section>

              {/* Current loans → return */}
              <section>
                <h2 className="mb-2 text-sm font-semibold">Currently borrowed</h2>
                {(wb?.loans ?? []).length === 0 ? (
                  <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                    No books out.
                  </p>
                ) : (
                  <div className="rounded-lg border bg-card">
                    {wb!.loans.map((l) => (
                      <label
                        key={l.id}
                        className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={loanSel.has(l.id)}
                          onChange={() => toggle(loanSel, setLoanSel, l.id)}
                        />
                        <span className="flex-1 font-medium">{l.bookTitle}</span>
                        <span
                          className={
                            isOverdue(l.due_date, null)
                              ? 'text-xs font-medium text-destructive'
                              : 'text-xs text-muted-foreground'
                          }
                        >
                          Due {fmtDate(l.due_date)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled={busy || loanSel.size === 0}
                  onClick={returnLoans}
                >
                  Return selected ({loanSel.size})
                </Button>
              </section>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  )
}
