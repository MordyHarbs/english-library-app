import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Plus, Snowflake, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtDate, todayStr } from '@/lib/format'
import type { Setting } from '@/lib/manage'
import {
  membershipFee,
  membershipMonths,
  membershipStatus,
  suggestPeriodEnd,
  type MembershipFreeze,
  type MembershipPayment,
} from '@/lib/membership'
import { MembershipBadge } from '@/components/MembershipBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface FreezeDraft {
  id?: string
  start_date: string
  end_date: string
  reason: string
}

interface Draft {
  id?: string
  paid_on: string
  period_start: string
  period_end: string
  /** True once the admin typed an end date, so changing the start no longer overwrites it. */
  endTouched: boolean
  amount: string
  method: string
  note: string
}

export function MembershipSection({
  memberId,
  settings,
}: {
  memberId: string
  settings: Setting[] | undefined
}) {
  const qc = useQueryClient()
  const months = membershipMonths(settings)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [freezeDraft, setFreezeDraft] = useState<FreezeDraft | null>(null)
  const [busy, setBusy] = useState(false)

  const { data: payments, isLoading } = useQuery({
    queryKey: ['admin', 'membershipPayments', 'member', memberId],
    queryFn: async (): Promise<MembershipPayment[]> => {
      const { data, error } = await supabase
        .from('membership_payments')
        .select('*')
        .eq('member_id', memberId)
        .order('period_end', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: freezes } = useQuery({
    queryKey: ['admin', 'membershipPayments', 'freezes', memberId],
    queryFn: async (): Promise<MembershipFreeze[]> => {
      const { data, error } = await supabase
        .from('membership_freezes')
        .select('*')
        .eq('member_id', memberId)
        .order('start_date', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const status = membershipStatus(payments, todayStr(), freezes)
  // Status ignoring freezes, so the card can still show what the payments say.
  const paymentStatus = membershipStatus(payments, todayStr())

  function openNew() {
    // Default to continuing straight after the current coverage, otherwise today.
    const latestEnd = payments?.[0]?.period_end
    const start = latestEnd && latestEnd >= todayStr() ? latestEnd : todayStr()
    const fee = membershipFee(settings)
    setDraft({
      paid_on: todayStr(),
      period_start: start,
      period_end: suggestPeriodEnd(start, months),
      endTouched: false,
      amount: fee > 0 ? String(fee) : '',
      method: '',
      note: '',
    })
  }

  function openEdit(p: MembershipPayment) {
    setDraft({
      id: p.id,
      paid_on: p.paid_on,
      period_start: p.period_start,
      period_end: p.period_end,
      endTouched: true,
      amount: p.amount == null ? '' : String(p.amount),
      method: p.method ?? '',
      note: p.note ?? '',
    })
  }

  function setStart(value: string) {
    if (!draft) return
    setDraft({
      ...draft,
      period_start: value,
      period_end: draft.endTouched ? draft.period_end : suggestPeriodEnd(value, months),
    })
  }

  async function save() {
    if (!draft) return
    if (!draft.paid_on || !draft.period_start || !draft.period_end) {
      return toast.error('Fill in the payment date and both period dates.')
    }
    if (draft.period_end < draft.period_start) {
      return toast.error('"Valid until" must be on or after "Valid from".')
    }
    const amount = draft.amount.trim() === '' ? null : Number(draft.amount)
    if (amount != null && !Number.isFinite(amount)) return toast.error('Amount must be a number.')
    const row = {
      member_id: memberId,
      paid_on: draft.paid_on,
      period_start: draft.period_start,
      period_end: draft.period_end,
      amount,
      method: draft.method.trim() || null,
      note: draft.note.trim() || null,
    }
    setBusy(true)
    try {
      const { error } = draft.id
        ? await supabase.from('membership_payments').update(row).eq('id', draft.id)
        : await supabase.from('membership_payments').insert(row)
      if (error) throw error
      toast.success(draft.id ? 'Payment updated.' : 'Payment recorded.')
      setDraft(null)
      qc.invalidateQueries({ queryKey: ['admin', 'membershipPayments'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(p: MembershipPayment) {
    if (!window.confirm(`Delete the payment of ${fmtDate(p.paid_on)}? This cannot be undone.`)) return
    setBusy(true)
    try {
      const { error } = await supabase.from('membership_payments').delete().eq('id', p.id)
      if (error) throw error
      toast.success('Payment deleted.')
      qc.invalidateQueries({ queryKey: ['admin', 'membershipPayments'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function saveFreeze() {
    if (!freezeDraft) return
    if (!freezeDraft.start_date) return toast.error('Pick a start date.')
    if (freezeDraft.end_date && freezeDraft.end_date < freezeDraft.start_date) {
      return toast.error('The end date must be on or after the start date.')
    }
    const row = {
      member_id: memberId,
      start_date: freezeDraft.start_date,
      end_date: freezeDraft.end_date || null,
      reason: freezeDraft.reason.trim() || null,
    }
    setBusy(true)
    try {
      const { error } = freezeDraft.id
        ? await supabase.from('membership_freezes').update(row).eq('id', freezeDraft.id)
        : await supabase.from('membership_freezes').insert(row)
      if (error) throw error
      toast.success(freezeDraft.id ? 'Freeze updated.' : 'Membership frozen.')
      setFreezeDraft(null)
      qc.invalidateQueries({ queryKey: ['admin', 'membershipPayments'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function endFreezeToday(f: MembershipFreeze) {
    setBusy(true)
    try {
      const end = todayStr() < f.start_date ? f.start_date : todayStr()
      const { error } = await supabase.from('membership_freezes').update({ end_date: end }).eq('id', f.id)
      if (error) throw error
      toast.success('Freeze ended.')
      qc.invalidateQueries({ queryKey: ['admin', 'membershipPayments'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeFreeze(f: MembershipFreeze) {
    if (!window.confirm('Delete this freeze? This cannot be undone.')) return
    setBusy(true)
    try {
      const { error } = await supabase.from('membership_freezes').delete().eq('id', f.id)
      if (error) throw error
      toast.success('Freeze deleted.')
      qc.invalidateQueries({ queryKey: ['admin', 'membershipPayments'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Membership dues</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFreezeDraft({ start_date: todayStr(), end_date: '', reason: '' })}
          >
            <Snowflake className="size-4" /> Freeze
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" /> Record payment
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <MembershipBadge status={status} />
          {status.state === 'frozen' && status.freeze ? (
            <span className="text-sm text-muted-foreground">
              Frozen since {fmtDate(status.freeze.start_date)}
              {status.freeze.end_date ? ` until ${fmtDate(status.freeze.end_date)}` : ' (no end date)'}
              {' · '}no payment needed
            </span>
          ) : (
            status.payment &&
            status.state !== 'none' && (
              <span className="text-sm text-muted-foreground">
                Valid {fmtDate(status.payment.period_start)} → {fmtDate(status.payment.period_end)}
              </span>
            )
          )}
          {status.state === 'frozen' && paymentStatus.payment && paymentStatus.state !== 'none' && (
            <span className="text-xs text-muted-foreground">
              Last payment covered until {fmtDate(paymentStatus.payment.period_end)}
            </span>
          )}
        </div>

        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : !payments || payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <div className="mt-3 divide-y rounded-md border">
            {payments.map((p) => (
              <div
                key={p.id}
                className="grid gap-2 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {fmtDate(p.period_start)} → {fmtDate(p.period_end)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paid {fmtDate(p.paid_on)}
                    {p.amount != null ? ` · ₪${Number(p.amount).toFixed(2)}` : ''}
                    {p.method ? ` · ${p.method}` : ''}
                    {p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => openEdit(p)}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => remove(p)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {freezes && freezes.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Freezes</p>
            <div className="divide-y rounded-md border">
              {freezes.map((f) => {
                const live = f.start_date <= todayStr() && (!f.end_date || todayStr() <= f.end_date)
                return (
                  <div
                    key={f.id}
                    className="grid gap-2 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {fmtDate(f.start_date)} → {f.end_date ? fmtDate(f.end_date) : 'no end date'}
                        {live && (
                          <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            in effect
                          </span>
                        )}
                      </p>
                      {f.reason && <p className="text-xs text-muted-foreground">{f.reason}</p>}
                    </div>
                    <div className="flex gap-2">
                      {live && !f.end_date && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => endFreezeToday(f)}>
                          End today
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          setFreezeDraft({
                            id: f.id,
                            start_date: f.start_date,
                            end_date: f.end_date ?? '',
                            reason: f.reason ?? '',
                          })
                        }
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => removeFreeze(f)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit payment' : 'Record payment'}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Date paid</Label>
                <Input
                  type="date"
                  value={draft.paid_on}
                  onChange={(e) => setDraft({ ...draft, paid_on: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Valid from</Label>
                  <Input type="date" value={draft.period_start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valid until</Label>
                  <Input
                    type="date"
                    value={draft.period_end}
                    onChange={(e) => setDraft({ ...draft, period_end: e.target.value, endTouched: true })}
                  />
                </div>
              </div>
              <p className="-mt-1 text-xs text-muted-foreground">
                {draft.endTouched ? (
                  <>
                    Custom end date.{' '}
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          period_end: suggestPeriodEnd(draft.period_start, months),
                          endTouched: false,
                        })
                      }
                    >
                      Reset to {months} months after the start
                    </button>
                  </>
                ) : (
                  `Suggested: ${months} month${months === 1 ? '' : 's'} after the start date. Edit to override.`
                )}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Amount (₪)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <Input
                    placeholder="Cash, Bit, transfer…"
                    value={draft.method}
                    onChange={(e) => setDraft({ ...draft, method: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!freezeDraft} onOpenChange={(o) => !o && setFreezeDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{freezeDraft?.id ? 'Edit freeze' : 'Freeze membership'}</DialogTitle>
          </DialogHeader>
          {freezeDraft && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                While frozen, the member doesn't need to pay. Leave the end date empty to keep it frozen
                until you end it.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Freeze from</Label>
                  <Input
                    type="date"
                    value={freezeDraft.start_date}
                    onChange={(e) => setFreezeDraft({ ...freezeDraft, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Until (optional)</Label>
                  <Input
                    type="date"
                    value={freezeDraft.end_date}
                    onChange={(e) => setFreezeDraft({ ...freezeDraft, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Input
                  value={freezeDraft.reason}
                  onChange={(e) => setFreezeDraft({ ...freezeDraft, reason: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFreezeDraft(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={saveFreeze}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
