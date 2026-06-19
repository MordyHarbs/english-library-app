import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Bell, BookOpen, Clock, Database, Mail, Pencil, Plus, Trash2 } from 'lucide-react'
import { AdminShell } from '@/components/AdminShell'
import { useAppNotices, useSettings, type AppNotice } from '@/lib/manage'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { callFunction } from '@/lib/functions'

const META: Record<string, { label: string; help?: string }> = {
  loan_duration_days: { label: 'Loan length', help: 'Default days before a book is due back.' },
  default_extend_days: { label: 'Extend length', help: 'Default days added when extending a loan.' },
  default_book_limit: { label: 'Soft limit', help: 'Warn when a request exceeds this many books.' },
  max_book_limit: { label: 'Hard limit', help: 'Block requests above this many books.' },
  late_fee_per_week: { label: 'Late fee / week', help: 'NIS per overdue week. 0 turns fees off.' },
  reminder_days_before: { label: 'Reminder lead time', help: 'Days before the due date to send a "due soon" email.' },
  daily_tasks_time: { label: 'Daily run time', help: 'Jerusalem time for Drive backups and reminder email checks.' },
  admin_notification_email: { label: 'Admin email', help: 'Where new-request alerts are sent.' },
  site_url: { label: 'Site URL', help: 'Base address used in email links.' },
  email_member_on_finalize: { label: 'On request finalized' },
  email_member_on_lend: { label: 'On books lent' },
  email_member_on_return: { label: 'On books returned' },
  email_due_soon: { label: 'Due-soon reminders' },
  email_overdue: { label: 'Overdue reminders' },
  email_welcome_on_create: { label: 'Welcome email for new members' },
}

const LENDING_KEYS = [
  'loan_duration_days',
  'default_extend_days',
  'default_book_limit',
  'max_book_limit',
  'late_fee_per_week',
  'reminder_days_before',
  'admin_notification_email',
  'site_url',
]

const SCHEDULE_KEYS = ['daily_tasks_time']

const OBSOLETE_NOTICE_SETTING_KEYS = [
  'app_notification_enabled',
  'app_notification_title',
  'app_notification_body',
]

type NoticeDraft = {
  id?: string
  title: string
  body: string
  is_active: boolean
  sort_order: number
  dismissal_version: number
}

function Toggle({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }) {
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

function noticeToDraft(notice: AppNotice): NoticeDraft {
  return {
    id: notice.id,
    title: notice.title,
    body: notice.body,
    is_active: notice.is_active,
    sort_order: notice.sort_order,
    dismissal_version: notice.dismissal_version,
  }
}

function isSchemaCacheColumnError(error: unknown) {
  if (error instanceof Error) return /schema cache|dismissal_version/i.test(error.message)
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return /schema cache|dismissal_version/i.test(String(error.message))
  }
  return /schema cache|dismissal_version/i.test(String(error))
}

export default function Settings() {
  const { data: settings, isLoading } = useSettings()
  const { data: notices, error: noticesError, isLoading: noticesLoading } = useAppNotices()
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [noticeDraft, setNoticeDraft] = useState<NoticeDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)

  const rows = settings ?? []
  const noticeRows = notices ?? []
  const nextNoticeSort = Math.max(0, ...noticeRows.map((notice) => notice.sort_order)) + 10
  const lendingRows = rows.filter((setting) => LENDING_KEYS.includes(setting.key))
  const scheduleRows = rows.filter((setting) => SCHEDULE_KEYS.includes(setting.key))
  const emailRows = rows.filter(
    (setting) =>
      typeof setting.value === 'boolean' && !OBSOLETE_NOTICE_SETTING_KEYS.includes(setting.key),
  )
  const noticeSchemaMissing = noticesError
    ? /schema cache|app_notices/i.test((noticesError as Error).message)
    : false

  const refreshNotices = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'appNotices'] })
    qc.invalidateQueries({ queryKey: ['activeAppNotices'] })
  }

  async function save() {
    setBusy(true)
    try {
      const results = await Promise.all(
        Object.entries(draft).map(([key, value]) =>
          supabase.from('settings').update({ value: value as never }).eq('key', key),
        ),
      )
      const err = results.find((result) => result.error)
      if (err?.error) throw err.error
      toast.success('Settings saved.')
      setDraft({})
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] })
      qc.invalidateQueries({ queryKey: ['publicSettings'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function saveNotice() {
    if (!noticeDraft) return
    const title = noticeDraft.title.trim()
    const body = noticeDraft.body.trim()
    if (!title || !body) return toast.error('Notice title and body are required')

    setBusy(true)
    try {
      const payload = {
        title,
        body,
        is_active: noticeDraft.is_active,
        sort_order: Number(noticeDraft.sort_order),
        updated_at: new Date().toISOString(),
      }
      if (noticeDraft.id) {
        const { error } = await supabase
          .from('app_notices')
          .update({ ...payload, dismissal_version: noticeDraft.dismissal_version + 1 })
          .eq('id', noticeDraft.id)
        if (error) {
          if (!isSchemaCacheColumnError(error)) throw error
          const retry = await supabase.from('app_notices').update(payload).eq('id', noticeDraft.id)
          if (retry.error) throw retry.error
          toast.warning('Notice updated. Run the safe SQL snippet again to enable reset-after-reactivate.')
        }
      } else {
        const { error } = await supabase.from('app_notices').insert(payload)
        if (error) throw error
      }
      toast.success(noticeDraft.id ? 'Notice updated.' : 'Notice added.')
      setNoticeDraft(null)
      refreshNotices()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleNotice(notice: AppNotice, isActive: boolean) {
    setBusy(true)
    try {
      const fallbackPayload = {
        is_active: isActive,
        updated_at: new Date().toISOString(),
      }
      const payload = {
        is_active: isActive,
        dismissal_version:
          isActive && !notice.is_active ? notice.dismissal_version + 1 : notice.dismissal_version,
        updated_at: fallbackPayload.updated_at,
      }
      const { error } = await supabase
        .from('app_notices')
        .update(payload)
        .eq('id', notice.id)
      if (error) {
        if (!isSchemaCacheColumnError(error)) throw error
        const retry = await supabase
          .from('app_notices')
          .update(fallbackPayload)
          .eq('id', notice.id)
        if (retry.error) throw retry.error
        toast.warning('Notice updated. Run the safe SQL snippet again to enable reset-after-reactivate.')
      }
      refreshNotices()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function moveNotice(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= noticeRows.length) return

    const reordered = [...noticeRows]
    const [notice] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, notice)

    setBusy(true)
    try {
      const results = await Promise.all(
        reordered.map((row, rowIndex) =>
          supabase
            .from('app_notices')
            .update({ sort_order: (rowIndex + 1) * 10, updated_at: new Date().toISOString() })
            .eq('id', row.id),
        ),
      )
      const err = results.find((result) => result.error)
      if (err?.error) throw err.error
      refreshNotices()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteNotice(notice: AppNotice) {
    if (!window.confirm(`Delete "${notice.title}"?`)) return
    setBusy(true)
    try {
      const { error } = await supabase.from('app_notices').delete().eq('id', notice.id)
      if (error) throw error
      toast.success('Notice deleted.')
      refreshNotices()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function runBackup() {
    setBackupBusy(true)
    try {
      const result = await callFunction<{ backup_path?: string }>('backup-to-drive', { source: 'manual' })
      toast.success(result.backup_path ? `Backup saved: ${result.backup_path}` : 'Backup saved to Drive.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBackupBusy(false)
    }
  }

  return (
    <AdminShell
      title="Settings"
      actions={
        <Button disabled={busy || Object.keys(draft).length === 0} onClick={save}>
          {busy ? 'Saving...' : 'Save changes'}
        </Button>
      }
    >
      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading...</p>
      ) : (
        <div className="max-w-3xl space-y-6">
          <section className="overflow-hidden rounded-xl border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-secondary/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-accent" />
                <h2 className="font-medium">App notices</h2>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || noticeSchemaMissing}
                onClick={() =>
                  setNoticeDraft({
                    title: '',
                    body: '',
                    is_active: true,
                    sort_order: nextNoticeSort,
                    dismissal_version: 1,
                  })
                }
              >
                <Plus className="size-4" /> Add notice
              </Button>
            </header>
            {noticesLoading ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading notices...</p>
            ) : noticeSchemaMissing ? (
              <div className="px-5 py-5 text-sm">
                <p className="font-medium text-destructive">Notice storage is not installed in this Supabase database.</p>
                <p className="mt-1 text-muted-foreground">
                  Run the additive SQL in supabase/snippets/create-app-notices-safe.sql from the Supabase SQL editor.
                </p>
              </div>
            ) : noticeRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No notices yet.</p>
            ) : (
              <div className="divide-y">
                {noticeRows.map((notice, index) => (
                  <div key={notice.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                    <div className="flex gap-1 sm:flex-col">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        disabled={busy || index === 0}
                        onClick={() => moveNotice(index, -1)}
                      >
                        <ArrowUp className="size-3" />
                        <span className="sr-only">Move up</span>
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        disabled={busy || index === noticeRows.length - 1}
                        onClick={() => moveNotice(index, 1)}
                      >
                        <ArrowDown className="size-3" />
                        <span className="sr-only">Move down</span>
                      </Button>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium leading-tight">{notice.title}</p>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            notice.is_active
                              ? 'bg-success/12 text-success'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {notice.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {notice.body}
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Toggle on={notice.is_active} onChange={(value) => toggleNotice(notice, value)} />
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setNoticeDraft(noticeToDraft(notice))}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">Edit notice</span>
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        onClick={() => deleteNotice(notice)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Delete notice</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <header className="flex items-center gap-2 border-b bg-secondary/40 px-5 py-3">
              <BookOpen className="size-4 text-accent" />
              <h2 className="font-medium">Lending &amp; limits</h2>
            </header>
            <div className="divide-y">
              {lendingRows.map((setting) => {
                const meta = META[setting.key] ?? { label: setting.key }
                const isNum = typeof setting.value === 'number'
                return (
                  <div key={setting.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{meta.label}</p>
                      {meta.help && <p className="text-xs text-muted-foreground">{meta.help}</p>}
                    </div>
                    <Input
                      type={isNum ? 'number' : 'text'}
                      value={String(draft[setting.key] ?? setting.value ?? '')}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [setting.key]: isNum ? Number(e.target.value) : e.target.value,
                        })
                      }
                      className={isNum ? 'w-24 text-right' : 'w-64'}
                    />
                  </div>
                )
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <header className="flex items-center gap-2 border-b bg-secondary/40 px-5 py-3">
              <Mail className="size-4 text-accent" />
              <h2 className="font-medium">Email notifications</h2>
            </header>
            <div className="divide-y">
              {emailRows.map((setting) => {
                const meta = META[setting.key] ?? { label: setting.key }
                return (
                  <div key={setting.key} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{meta.label}</p>
                      {meta.help && <p className="text-xs text-muted-foreground">{meta.help}</p>}
                    </div>
                    <Toggle
                      on={!!(draft[setting.key] ?? setting.value)}
                      onChange={(value) => setDraft({ ...draft, [setting.key]: value })}
                    />
                  </div>
                )
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <header className="flex items-center gap-2 border-b bg-secondary/40 px-5 py-3">
              <Clock className="size-4 text-accent" />
              <h2 className="font-medium">Daily automation</h2>
            </header>
            <div className="divide-y">
              {scheduleRows.map((setting) => {
                const meta = META[setting.key] ?? { label: setting.key }
                return (
                  <div key={setting.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{meta.label}</p>
                      {meta.help && <p className="text-xs text-muted-foreground">{meta.help}</p>}
                    </div>
                    <Input
                      type="time"
                      step={300}
                      value={String(draft[setting.key] ?? setting.value ?? '08:00')}
                      onChange={(e) => setDraft({ ...draft, [setting.key]: e.target.value })}
                      className="w-32"
                    />
                  </div>
                )
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <header className="flex items-center gap-2 border-b bg-secondary/40 px-5 py-3">
              <Database className="size-4 text-accent" />
              <h2 className="font-medium">Backups</h2>
            </header>
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Google Drive backup</p>
                <p className="text-xs text-muted-foreground">
                  Saves app data and cover files into dated folders in Drive. Old backups are never deleted.
                </p>
              </div>
              <Button disabled={backupBusy} onClick={runBackup}>
                {backupBusy ? 'Backing up...' : 'Back up now'}
              </Button>
            </div>
          </section>
        </div>
      )}

      <Dialog open={!!noticeDraft} onOpenChange={(open) => !open && setNoticeDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{noticeDraft?.id ? 'Edit notice' : 'Add notice'}</DialogTitle>
          </DialogHeader>
          {noticeDraft && (
            <div className="space-y-4">
              <Field label="Title">
                <Input
                  value={noticeDraft.title}
                  onChange={(e) => setNoticeDraft({ ...noticeDraft, title: e.target.value })}
                />
              </Field>
              <Field label="Body">
                <textarea
                  value={noticeDraft.body}
                  onChange={(e) => setNoticeDraft({ ...noticeDraft, body: e.target.value })}
                  rows={5}
                  className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </Field>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Active notices are shown when users open the app.</p>
                </div>
                <Toggle
                  on={noticeDraft.is_active}
                  onChange={(value) => setNoticeDraft({ ...noticeDraft, is_active: value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoticeDraft(null)}>Cancel</Button>
            <Button disabled={busy} onClick={saveNotice}>{busy ? 'Saving...' : 'Save notice'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
