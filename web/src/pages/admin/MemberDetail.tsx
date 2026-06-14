import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Search, Plus, X } from 'lucide-react'
import { AdminShell } from '@/components/AdminShell'
import { StatusBadge } from '@/components/StatusBadge'
import { supabase } from '@/lib/supabase'
import { callFunction } from '@/lib/functions'
import { useBooks } from '@/lib/queries'
import { fmtDate, isOverdue } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface MemberLoan {
  id: string
  date_given: string
  due_date: string
  date_returned: string | null
  title: string
}

function useMemberDetail(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['admin', 'member', id],
    queryFn: async () => {
      const { data: member, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      const { data: loanRows } = await supabase
        .from('loans')
        .select('id, date_given, due_date, date_returned, books(title)')
        .eq('member_id', id!)
        .order('date_given', { ascending: false })
      const loans: MemberLoan[] = (loanRows ?? []).map((l) => ({
        id: l.id,
        date_given: l.date_given,
        due_date: l.due_date,
        date_returned: l.date_returned,
        title: (l.books as { title: string } | null)?.title ?? 'Unknown',
      }))
      return { member, loans }
    },
  })
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm">{value || '—'}</p>
    </div>
  )
}

export default function MemberDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading } = useMemberDetail(id)
  const { data: allBooks } = useBooks()

  const [busy, setBusy] = useState(false)
  const [bookSearch, setBookSearch] = useState('')
  const [toLend, setToLend] = useState<{ id: string; title: string }[]>([])

  const bookMatches = useMemo(() => {
    const q = bookSearch.trim().toLowerCase()
    if (!q) return []
    return (allBooks ?? [])
      .filter((b) => `${b.title} ${b.author ?? ''}`.toLowerCase().includes(q))
      .filter((b) => !toLend.some((t) => t.id === b.id))
      .slice(0, 6)
  }, [allBooks, bookSearch, toLend])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin'] })
    qc.invalidateQueries({ queryKey: ['availability'] })
  }

  async function returnLoan(loanId: string) {
    setBusy(true)
    try {
      await callFunction('return-books', { loan_ids: [loanId] })
      toast.success('Returned.')
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function lend() {
    if (toLend.length === 0) return
    setBusy(true)
    try {
      const res = await callFunction<{ failed: unknown[] }>('lend-books', {
        member_id: id,
        items: toLend.map((t) => ({ book_id: t.id })),
      })
      const failed = res.failed?.length ?? 0
      toast.success(`Lent ${toLend.length - failed} book(s).`)
      if (failed) toast.error(`${failed} couldn't be lent (already out).`)
      setToLend([])
      setBookSearch('')
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) {
    return (
      <AdminShell title="Member">
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      </AdminShell>
    )
  }
  if (!data?.member) {
    return (
      <AdminShell title="Member">
        <p className="py-12 text-center text-muted-foreground">Not found.</p>
      </AdminShell>
    )
  }

  const m = data.member
  const open = data.loans.filter((l) => !l.date_returned)
  const history = data.loans.filter((l) => l.date_returned)
  const fees = Number(m.fees_owed ?? 0)

  return (
    <AdminShell title={m.name}>
      <button
        onClick={() => navigate('/admin/members')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to members
      </button>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Profile */}
        <div className="grid grid-cols-1 gap-4 self-start rounded-lg border bg-card p-5 sm:grid-cols-2">
          <Field label="Email" value={m.email} />
          <Field label="Phone" value={m.phone} />
          <Field label="Address" value={m.address} />
          <Field label="Membership" value={m.paid ? 'Paid' : 'Not paid'} />
          <Field label="Fees owed" value={fees > 0 ? `₪${fees.toFixed(2)}` : 'None'} />
          <Field label="Member since" value={fmtDate(m.date_added)} />
          {m.comments && (
            <div className="col-span-full">
              <Field label="Comments" value={m.comments} />
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Lend a book */}
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Lend a book to {m.name}</h2>
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
                      setToLend((a) => [...a, { id: b.id, title: b.title }])
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
            {toLend.length > 0 && (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {toLend.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm"
                    >
                      {a.title}
                      <button onClick={() => setToLend((l) => l.filter((x) => x.id !== a.id))}>
                        <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </span>
                  ))}
                </div>
                <Button className="mt-3" disabled={busy} onClick={lend}>
                  Lend {toLend.length} book(s)
                </Button>
              </>
            )}
          </section>

          {/* Currently borrowed */}
          <section>
            <h2 className="mb-2 text-sm font-semibold">Currently borrowed ({open.length})</h2>
            {open.length === 0 ? (
              <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                No books out.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                {open.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
                    <span className="min-w-0 flex-1 truncate font-medium">{l.title}</span>
                    <StatusBadge status={isOverdue(l.due_date, null) ? 'overdue' : 'on_loan'} />
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {fmtDate(l.due_date)}
                    </span>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => returnLoan(l.id)}>
                      Return
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* History */}
          <section>
            <h2 className="mb-2 text-sm font-semibold">History ({history.length})</h2>
            {history.length === 0 ? (
              <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                Nothing returned yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                {history.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 border-b px-4 py-2.5 last:border-b-0">
                    <span className="min-w-0 truncate">{l.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {fmtDate(l.date_given)} → {fmtDate(l.date_returned)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  )
}
