import { useState } from 'react'
import { toast } from 'sonner'
import { AccountShell } from '@/components/AccountShell'
import { useAuth } from '@/lib/auth'
import { callFunction } from '@/lib/functions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="mt-0.5 text-sm">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  )
}

export default function MyDetails() {
  const { member } = useAuth()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const fees = Number(member?.fees_owed ?? 0)

  async function sendChange() {
    if (!message.trim()) return toast.error('Describe the change you need')
    setBusy(true)
    try {
      await callFunction('member-request', { type: 'detail_change', message: message.trim() })
      toast.success('Sent to the library — they\'ll update your details.')
      setMessage('')
      setOpen(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AccountShell>
      <div className="max-w-lg space-y-6">
        <div className="grid grid-cols-2 gap-5 rounded-lg border bg-card p-5">
          <Field label="Name" value={member?.name} />
          <Field label="Email" value={member?.email} />
          <Field label="Phone" value={member?.phone} />
          <Field label="Address" value={member?.address} />
          <Field label="Membership" value={member?.paid ? 'Paid' : 'Not paid'} />
          <Field label="Fees owed" value={fees > 0 ? `₪${fees.toFixed(2)}` : 'None'} />
        </div>

        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Your details are managed by the library. Need something changed?
          </p>
          {!open ? (
            <Button variant="outline" className="mt-3" onClick={() => setOpen(true)}>
              Request a change
            </Button>
          ) : (
            <div className="mt-3 space-y-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="e.g. My phone number changed to…"
                className="w-full rounded-md border bg-background p-2 text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={sendChange} disabled={busy}>
                  {busy ? 'Sending…' : 'Send'}
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AccountShell>
  )
}
