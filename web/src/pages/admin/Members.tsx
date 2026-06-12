import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil } from 'lucide-react'
import { AdminShell } from '@/components/AdminShell'
import { useMembers, type Member } from '@/lib/manage'
import { supabase } from '@/lib/supabase'
import { callFunction } from '@/lib/functions'
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

type Draft = Partial<Member> & { id?: string }

export default function Members() {
  const { data: members, isLoading } = useMembers()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (members ?? []).filter(
      (m) => !q || `${m.name} ${m.email} ${m.phone ?? ''}`.toLowerCase().includes(q),
    )
  }, [members, search])

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'members'] })

  async function save() {
    if (!draft?.name?.trim()) return toast.error('Name is required')
    if (!draft.email?.trim()) return toast.error('Email is required')
    setBusy(true)
    try {
      if (draft.id) {
        const { error } = await supabase
          .from('members')
          .update({
            name: draft.name,
            email: draft.email.toLowerCase(),
            phone: draft.phone || null,
            address: draft.address || null,
            paid: !!draft.paid,
            is_admin: !!draft.is_admin,
            comments: draft.comments || null,
            fees_owed: Number(draft.fees_owed ?? 0),
          })
          .eq('id', draft.id)
        if (error) throw error
        toast.success('Member updated.')
      } else {
        await callFunction('create-member', {
          name: draft.name,
          email: draft.email,
          phone: draft.phone,
          address: draft.address,
          paid: !!draft.paid,
          is_admin: !!draft.is_admin,
          comments: draft.comments,
        })
        toast.success('Member added — welcome email sent.')
      }
      setDraft(null)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell
      title="Members"
      actions={
        <Button onClick={() => setDraft({ paid: true })}>
          <Plus className="size-4" /> Add member
        </Button>
      }
    >
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search members…"
        className="mb-4 sm:max-w-xs"
      />

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          {rows.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {m.name}
                  {m.is_admin && (
                    <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
                      admin
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {m.email}
                  {m.phone ? ` · ${m.phone}` : ''}
                </p>
              </div>
              {!m.paid && (
                <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning">
                  unpaid
                </span>
              )}
              {Number(m.fees_owed) > 0 && (
                <span className="text-xs font-medium text-destructive">
                  ₪{Number(m.fees_owed).toFixed(2)}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={() => setDraft(m)}>
                <Pencil className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit member' : 'Add member'}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <Field label="Name">
                <Input value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={draft.email ?? ''}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <Input value={draft.phone ?? ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                </Field>
                <Field label="Fees owed (₪)">
                  <Input
                    type="number"
                    value={String(draft.fees_owed ?? 0)}
                    onChange={(e) => setDraft({ ...draft, fees_owed: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <Field label="Address">
                <Input value={draft.address ?? ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
              </Field>
              <Field label="Comments">
                <Input value={draft.comments ?? ''} onChange={(e) => setDraft({ ...draft, comments: e.target.value })} />
              </Field>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={!!draft.paid}
                    onChange={(e) => setDraft({ ...draft, paid: e.target.checked })}
                  />
                  Membership paid
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={!!draft.is_admin}
                    onChange={(e) => setDraft({ ...draft, is_admin: e.target.checked })}
                  />
                  Admin
                </label>
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
