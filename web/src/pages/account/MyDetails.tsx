import { useState } from 'react'
import { toast } from 'sonner'
import { AccountShell } from '@/components/AccountShell'
import { useAuth } from '@/lib/auth'
import { callFunction } from '@/lib/functions'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="mt-0.5 break-words text-sm">
        {value || <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  )
}

export default function MyDetails() {
  const { member } = useAuth()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
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

  async function savePassword() {
    if (pw.length < 8) return toast.error('Password must be at least 8 characters')
    setPwBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) throw error
      await supabase.rpc('mark_password_set')
      toast.success('Password saved. You can use it to log in next time.')
      setPw('')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <AccountShell>
      <div className="max-w-lg space-y-6">
        <div className="grid grid-cols-1 gap-5 rounded-lg border bg-card p-5 sm:grid-cols-2">
          <Field label="Name" value={member?.name} />
          <Field label="Email" value={member?.email} />
          <Field label="Phone" value={member?.phone} />
          <Field label="Address" value={member?.address} />
          <Field label="Membership" value={member?.paid ? 'Paid' : 'Not paid'} />
          <Field label="Fees owed" value={fees > 0 ? `₪${fees.toFixed(2)}` : 'None'} />
        </div>

        {/* Password */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Password</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional — you can always log in with an emailed code instead. Set or
            change a password here.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="New password (min 8 characters)"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            <Button onClick={savePassword} disabled={pwBusy} className="shrink-0">
              {pwBusy ? 'Saving…' : 'Save password'}
            </Button>
          </div>
        </div>

        {/* Request a change */}
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
