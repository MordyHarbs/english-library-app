import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { BookOpen, Mail } from 'lucide-react'
import { AdminShell } from '@/components/AdminShell'
import { useSettings } from '@/lib/manage'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const META: Record<string, { label: string; help?: string }> = {
  loan_duration_days: { label: 'Loan length', help: 'Default days before a book is due back.' },
  default_book_limit: { label: 'Soft limit', help: 'Warn when a request exceeds this many books.' },
  max_book_limit: { label: 'Hard limit', help: 'Block requests above this many books.' },
  late_fee_per_week: { label: 'Late fee / week', help: '₪ per overdue week. 0 turns fees off.' },
  reminder_days_before: { label: 'Reminder lead time', help: 'Days before the due date to send a "due soon" email.' },
  admin_notification_email: { label: 'Admin email', help: 'Where new-request alerts are sent.' },
  site_url: { label: 'Site URL', help: 'Base address used in email links.' },
  email_member_on_finalize: { label: 'On request finalized' },
  email_member_on_lend: { label: 'On books lent' },
  email_member_on_return: { label: 'On books returned' },
  email_due_soon: { label: 'Due-soon reminders' },
  email_overdue: { label: 'Overdue reminders' },
  email_welcome_on_create: { label: 'Welcome email for new members' },
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        on ? 'bg-primary' : 'bg-input',
      )}
    >
      <span
        className={cn(
          'inline-block size-5 transform rounded-full bg-background shadow transition-transform',
          on ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
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
      const results = await Promise.all(
        Object.entries(draft).map(([key, value]) =>
          supabase.from('settings').update({ value: value as never }).eq('key', key),
        ),
      )
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

  const valueRows = (settings ?? []).filter((s) => typeof s.value !== 'boolean')
  const toggleRows = (settings ?? []).filter((s) => typeof s.value === 'boolean')

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
        <div className="max-w-2xl space-y-6">
          {/* Lending & limits */}
          <section className="overflow-hidden rounded-xl border bg-card">
            <header className="flex items-center gap-2 border-b bg-secondary/40 px-5 py-3">
              <BookOpen className="size-4 text-accent" />
              <h2 className="font-medium">Lending &amp; limits</h2>
            </header>
            <div className="divide-y">
              {valueRows.map((s) => {
                const meta = META[s.key] ?? { label: s.key }
                const isNum = typeof s.value === 'number'
                return (
                  <div key={s.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{meta.label}</p>
                      {meta.help && <p className="text-xs text-muted-foreground">{meta.help}</p>}
                    </div>
                    <Input
                      type={isNum ? 'number' : 'text'}
                      value={String(draft[s.key] ?? '')}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [s.key]: isNum ? Number(e.target.value) : e.target.value,
                        })
                      }
                      className={isNum ? 'w-24 text-right' : 'w-64'}
                    />
                  </div>
                )
              })}
            </div>
          </section>

          {/* Email notifications */}
          <section className="overflow-hidden rounded-xl border bg-card">
            <header className="flex items-center gap-2 border-b bg-secondary/40 px-5 py-3">
              <Mail className="size-4 text-accent" />
              <h2 className="font-medium">Email notifications</h2>
            </header>
            <div className="divide-y">
              {toggleRows.map((s) => {
                const meta = META[s.key] ?? { label: s.key }
                return (
                  <div key={s.key} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{meta.label}</p>
                      {meta.help && <p className="text-xs text-muted-foreground">{meta.help}</p>}
                    </div>
                    <Toggle
                      on={!!draft[s.key]}
                      onChange={(v) => setDraft({ ...draft, [s.key]: v })}
                    />
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  )
}
