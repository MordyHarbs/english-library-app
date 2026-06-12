import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { AdminShell } from '@/components/AdminShell'
import { useSettings, type Setting } from '@/lib/manage'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Human labels + grouping for known keys.
const LABELS: Record<string, string> = {
  loan_duration_days: 'Loan length (days)',
  default_book_limit: 'Soft limit — warn above this many books',
  max_book_limit: 'Hard limit — block above this many books',
  late_fee_per_week: 'Late fee per week (₪, 0 = off)',
  reminder_days_before: 'Send "due soon" this many days before',
  email_member_on_finalize: 'Email member when a request is finalized',
  email_member_on_lend: 'Email member when books are lent',
  email_member_on_return: 'Email member when books are returned',
  email_due_soon: 'Send "due soon" reminders',
  email_overdue: 'Send overdue reminders',
  email_welcome_on_create: 'Send welcome email to new members',
  admin_notification_email: 'Admin notification email',
  site_url: 'Site URL (used in email links)',
}

export default function Settings() {
  const { data: settings, isLoading } = useSettings()
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (settings) {
      const d: Record<string, unknown> = {}
      for (const s of settings) d[s.key] = s.value
      setDraft(d)
    }
  }, [settings])

  async function save() {
    setBusy(true)
    try {
      const updates = Object.entries(draft).map(([key, value]) =>
        supabase.from('settings').update({ value: value as never }).eq('key', key),
      )
      const results = await Promise.all(updates)
      const err = results.find((r) => r.error)
      if (err?.error) throw err.error
      toast.success('Settings saved.')
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] })
      qc.invalidateQueries({ queryKey: ['publicSettings'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const render = (s: Setting) => {
    const v = draft[s.key]
    if (typeof s.value === 'boolean') {
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={!!v}
            onChange={(e) => setDraft({ ...draft, [s.key]: e.target.checked })}
          />
          {LABELS[s.key] ?? s.key}
        </label>
      )
    }
    const isNum = typeof s.value === 'number'
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{LABELS[s.key] ?? s.key}</label>
        <Input
          type={isNum ? 'number' : 'text'}
          value={String(v ?? '')}
          onChange={(e) =>
            setDraft({ ...draft, [s.key]: isNum ? Number(e.target.value) : e.target.value })
          }
          className="max-w-sm"
        />
      </div>
    )
  }

  const booleans = (settings ?? []).filter((s) => typeof s.value === 'boolean')
  const others = (settings ?? []).filter((s) => typeof s.value !== 'boolean')

  return (
    <AdminShell
      title="Settings"
      actions={
        <Button disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      }
    >
      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="max-w-2xl space-y-8">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Lending & limits</h2>
            {others.map((s) => (
              <div key={s.key}>{render(s)}</div>
            ))}
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Email notifications</h2>
            {booleans.map((s) => (
              <div key={s.key}>{render(s)}</div>
            ))}
          </section>
        </div>
      )}
    </AdminShell>
  )
}
