import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { AdminShell } from '@/components/AdminShell'
import { BookThumb } from '@/components/BookThumb'
import { StatusBadge } from '@/components/StatusBadge'
import { useReservationDetail, type DetailItem, type ItemStatus } from '@/lib/admin'
import { callFunction } from '@/lib/functions'
import { supabase } from '@/lib/supabase'
import { fmtDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface MemberDraft {
  name: string
  email: string
  phone: string
  address: string
  paid: boolean
  comments: string
}

type Decision = 'pending' | 'approved' | 'rejected' | 'lend'

interface FinalizeResult {
  ok?: boolean
  failed?: { item_id: string; reason: string }[]
}

export default function ReservationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: r, isLoading } = useReservationDetail(id)

  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [detailBook, setDetailBook] = useState<DetailItem | null>(null)
  const [memberDraft, setMemberDraft] = useState<MemberDraft | null>(null)

  // Initialise decisions from current item statuses.
  useEffect(() => {
    if (r) {
      const init: Record<string, Decision> = {}
      for (const it of r.items) {
        init[it.id] = it.status === 'pending' ? 'pending' : (it.status as Decision)
      }
      setDecisions(init)
    }
  }, [r])

  if (isLoading) {
    return (
      <AdminShell title="Reservation">
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      </AdminShell>
    )
  }
  if (!r) {
    return (
      <AdminShell title="Reservation">
        <p className="py-12 text-center text-muted-foreground">Not found.</p>
      </AdminShell>
    )
  }

  const decidableItems = r.items.filter((it) => it.status === 'pending')

  async function finalize() {
    const changes = decidableItems
      .filter((it) => ['approved', 'rejected', 'lend'].includes(decisions[it.id]))
      .map((it) => ({ item_id: it.id, status: decisions[it.id] as 'approved' | 'rejected' | 'lend' }))

    if (changes.length === 0)
      return toast.error('Set at least one book to Approve, Lend, or Reject first.')

    setBusy(true)
    try {
      const res = await callFunction<FinalizeResult>('finalize-reservation', {
        reservation_id: r!.id,
        decisions: changes,
        message: message.trim(),
      })
      const failed = res.failed ?? []
      if (failed.length > 0) {
        toast.error(`${failed.length} book(s) couldn't be lent: ${failed[0].reason}`)
      } else {
        toast.success('Reservation finalized — the member has been emailed.')
      }
      qc.invalidateQueries({ queryKey: ['admin'] })
      qc.invalidateQueries({ queryKey: ['myLoans'] })
      qc.invalidateQueries({ queryKey: ['myReservations'] })
      navigate('/admin/reservations')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteReservation() {
    if (!r) return
    if (!window.confirm(`Delete ${r.name}'s reservation? This cannot be undone.`)) return
    setBusy(true)
    try {
      await callFunction('delete-reservations', { reservation_ids: [r.id] })
      toast.success('Reservation deleted.')
      qc.invalidateQueries({ queryKey: ['admin'] })
      qc.invalidateQueries({ queryKey: ['myReservations'] })
      navigate('/admin/reservations')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function openMemberDraft() {
    if (!r) return
    setMemberDraft({
      name: r.name,
      email: r.email,
      phone: r.phone ?? '',
      address: r.address ?? '',
      paid: false,
      comments: r.comments ? `From reservation: ${r.comments}` : '',
    })
  }

  async function createMemberFromReservation() {
    if (!r || !memberDraft) return
    if (!memberDraft.name.trim()) return toast.error('Name is required')
    setBusy(true)
    try {
      const email = memberDraft.email.trim().toLowerCase() || null
      let memberId: string | null = null

      if (email) {
        const { data: existing, error: existingError } = await supabase
          .from('members')
          .select('id')
          .eq('email', email)
          .maybeSingle()
        if (existingError) throw existingError
        memberId = existing?.id ?? null
      }

      if (!memberId) {
        const created = await callFunction<{ member_id: string }>('create-member', {
          name: memberDraft.name.trim(),
          email,
          phone: memberDraft.phone.trim() || null,
          address: memberDraft.address.trim() || null,
          paid: memberDraft.paid,
          comments: memberDraft.comments.trim() || null,
        })
        memberId = created.member_id
      }

      const { error } = await supabase
        .from('reservations')
        .update({ member_id: memberId })
        .eq('id', r.id)
      if (error) throw error

      toast.success('Member added and linked to this reservation.')
      setMemberDraft(null)
      qc.invalidateQueries({ queryKey: ['admin'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell title="Reservation">
      <button
        onClick={() => navigate('/admin/reservations')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to queue
      </button>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Items + decisions */}
        <div className="space-y-3">
          {r.items.map((it) => (
            <div key={it.id} className="flex gap-3 rounded-lg border bg-card p-3">
              <BookThumb cover_path={it.cover_path} title={it.title} />
              <div className="min-w-0 flex-1">
                <p className="font-display font-medium leading-snug">{it.title}</p>
                {it.author && (
                  <p className="text-sm text-muted-foreground">{it.author}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {it.isAvailable ? (
                    <span className="text-xs font-medium text-success">● Available</span>
                  ) : (
                    <span className="text-xs font-medium text-warning">
                      ● Out{it.expectedReturn ? ` · back ${it.expectedReturn}` : ''}
                    </span>
                  )}
                  <button
                    onClick={() => setDetailBook(it)}
                    className="text-xs font-medium underline text-muted-foreground hover:text-foreground"
                  >
                    View details
                  </button>
                </div>

                <div className="mt-2">
                  {it.status === 'pending' ? (
                    <Select
                      value={decisions[it.id] ?? 'pending'}
                      onValueChange={(v) =>
                        setDecisions((d) => ({ ...d, [it.id]: v as Decision }))
                      }
                    >
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">No decision</SelectItem>
                        <SelectItem value="approved">Approve (hold)</SelectItem>
                        {r.member_id && (
                          <SelectItem value="lend">Approve & lend now</SelectItem>
                        )}
                        <SelectItem value="rejected">Reject</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <StatusBadge status={it.status as ItemStatus} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Requester + finalize */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 text-sm">
            <p className="font-medium">{r.name}</p>
            <p className="text-muted-foreground">{r.email}</p>
            {!r.member_id && (
              <div className="mt-2 rounded-md bg-warning/10 p-2 text-xs text-warning">
                New / non-member
                <br />
                Phone: {r.phone || '—'}
                <br />
                Address: {r.address || '—'}
              </div>
            )}
            {!r.member_id && (
              <Button className="mt-3 w-full" variant="outline" disabled={busy} onClick={openMemberDraft}>
                Add member from request
              </Button>
            )}
            <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div>Requested {fmtDate(r.created_at)}</div>
              {r.pickup_time && <div>Pickup: {r.pickup_time}</div>}
              {r.comments && <div className="text-foreground">Note: {r.comments}</div>}
            </dl>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <Button variant="destructive" className="w-full" disabled={busy} onClick={deleteReservation}>
              Delete reservation
            </Button>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <label className="text-sm font-medium">Message to member (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Included in the confirmation email…"
              className="mt-2 w-full rounded-md border bg-background p-2 text-sm"
            />
            <Button className="mt-3 w-full" disabled={busy} onClick={finalize}>
              {busy ? 'Finalizing…' : 'Finalize reservation'}
            </Button>
            {decidableItems.length === 0 && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                All items already decided.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Book details dialog */}
      <Dialog open={!!detailBook} onOpenChange={(o) => !o && setDetailBook(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{detailBook?.title}</DialogTitle>
          </DialogHeader>
          {detailBook && (
            <div className="flex gap-4">
              <BookThumb
                cover_path={detailBook.cover_path}
                title={detailBook.title}
                className="h-40 w-28"
              />
              <div className="min-w-0 flex-1 text-sm">
                {detailBook.author && <p className="text-muted-foreground">{detailBook.author}</p>}
                {detailBook.pages ? (
                  <p className="mt-1 text-xs text-muted-foreground">{detailBook.pages} pages</p>
                ) : null}
                {detailBook.description && (
                  <p className="mt-2 leading-relaxed">{detailBook.description}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!memberDraft} onOpenChange={(open) => !open && setMemberDraft(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add member from request</DialogTitle>
          </DialogHeader>
          {memberDraft && (
            <div className="space-y-3">
              <Field label="Name">
                <Input value={memberDraft.name} onChange={(e) => setMemberDraft({ ...memberDraft, name: e.target.value })} />
              </Field>
              <Field label="Email (optional)">
                <Input
                  type="email"
                  value={memberDraft.email}
                  onChange={(e) => setMemberDraft({ ...memberDraft, email: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <Input value={memberDraft.phone} onChange={(e) => setMemberDraft({ ...memberDraft, phone: e.target.value })} />
                </Field>
                <Field label="Membership">
                  <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={memberDraft.paid}
                      onChange={(e) => setMemberDraft({ ...memberDraft, paid: e.target.checked })}
                    />
                    Paid
                  </label>
                </Field>
              </div>
              <Field label="Address">
                <Input value={memberDraft.address} onChange={(e) => setMemberDraft({ ...memberDraft, address: e.target.value })} />
              </Field>
              <Field label="Comments">
                <Input value={memberDraft.comments} onChange={(e) => setMemberDraft({ ...memberDraft, comments: e.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMemberDraft(null)}>Cancel</Button>
            <Button disabled={busy} onClick={createMemberFromReservation}>
              {busy ? 'Adding…' : 'Add member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
