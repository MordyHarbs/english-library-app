import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { AdminShell } from '@/components/AdminShell'
import { StatusBadge } from '@/components/StatusBadge'
import { supabase } from '@/lib/supabase'
import { fmtDate, isOverdue } from '@/lib/format'

interface MemberLoan {
  id: string
  date_given: string
  due_date: string
  date_returned: string | null
  title: string
  author: string | null
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
        .select('id, date_given, due_date, date_returned, books(title, author)')
        .eq('member_id', id!)
        .order('date_given', { ascending: false })
      const loans: MemberLoan[] = (loanRows ?? []).map((l) => ({
        id: l.id,
        date_given: l.date_given,
        due_date: l.due_date,
        date_returned: l.date_returned,
        title: (l.books as { title: string } | null)?.title ?? 'Unknown',
        author: (l.books as { author: string | null } | null)?.author ?? null,
      }))
      return { member, loans }
    },
  })
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value || '—'}</p>
    </div>
  )
}

export default function MemberDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useMemberDetail(id)

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
        <div className="grid grid-cols-2 gap-4 self-start rounded-lg border bg-card p-5">
          <Field label="Email" value={m.email} />
          <Field label="Phone" value={m.phone} />
          <Field label="Address" value={m.address} />
          <Field label="Membership" value={m.paid ? 'Paid' : 'Not paid'} />
          <Field label="Fees owed" value={fees > 0 ? `₪${fees.toFixed(2)}` : 'None'} />
          <Field label="Member since" value={fmtDate(m.date_added)} />
          {m.comments && (
            <div className="col-span-2">
              <Field label="Comments" value={m.comments} />
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Currently borrowed */}
          <section>
            <h2 className="mb-2 text-sm font-semibold">
              Currently borrowed ({open.length})
            </h2>
            {open.length === 0 ? (
              <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                No books out.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                {open.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 border-b px-4 py-2.5 last:border-b-0">
                    <span className="min-w-0 truncate font-medium">{l.title}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={isOverdue(l.due_date, null) ? 'overdue' : 'on_loan'} />
                      <span className="text-xs text-muted-foreground">{fmtDate(l.due_date)}</span>
                    </div>
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
