import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, ArrowRightLeft } from 'lucide-react'
import { AdminShell } from '@/components/AdminShell'
import { useBooks, useCategories, type Category } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const NO_CATEGORY = '__none__'

type Draft = Partial<Category> & { id?: string }
type MoveDraft = { fromId: string; toId: string }

export default function Categories() {
  const { data: categories, isLoading } = useCategories()
  const { data: books } = useBooks()
  const qc = useQueryClient()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [moveDraft, setMoveDraft] = useState<MoveDraft | null>(null)
  const [busy, setBusy] = useState(false)

  const countByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const book of books ?? []) {
      const key = book.category_id ?? NO_CATEGORY
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [books])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['categories'] })
    qc.invalidateQueries({ queryKey: ['books'] })
  }

  async function saveCategory() {
    const name = draft?.name?.trim()
    if (!name) return toast.error('Category name is required')
    setBusy(true)
    try {
      const payload = {
        name,
        sort_order: Number(draft?.sort_order ?? 999),
      }
      if (draft?.id) {
        const { error } = await supabase.from('categories').update(payload).eq('id', draft.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('categories').insert(payload)
        if (error) throw error
      }
      toast.success(draft?.id ? 'Category updated.' : 'Category added.')
      setDraft(null)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteCategory(category: Category) {
    const count = countByCategory.get(category.id) ?? 0
    const message = count > 0
      ? `Delete "${category.name}"? ${count} book(s) will become uncategorized.`
      : `Delete "${category.name}"?`
    if (!window.confirm(message)) return
    setBusy(true)
    try {
      const { error } = await supabase.from('categories').delete().eq('id', category.id)
      if (error) throw error
      toast.success('Category deleted.')
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function moveBooks() {
    if (!moveDraft) return
    const toCategory = moveDraft.toId === NO_CATEGORY ? null : moveDraft.toId
    setBusy(true)
    try {
      const { error } = await supabase
        .from('books')
        .update({ category_id: toCategory })
        .eq('category_id', moveDraft.fromId)
      if (error) throw error
      toast.success('Books moved.')
      setMoveDraft(null)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell
      title="Categories"
      actions={
        <Button onClick={() => setDraft({ sort_order: 999 })}>
          <Plus className="size-4" /> Add category
        </Button>
      }
    >
      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-28 text-right">Books</TableHead>
                <TableHead className="w-28 text-right">Sort</TableHead>
                <TableHead className="w-60 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(categories ?? []).map((category) => {
                const count = countByCategory.get(category.id) ?? 0
                return (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-right">{count}</TableCell>
                    <TableCell className="text-right">{category.sort_order}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || count === 0}
                          onClick={() => setMoveDraft({ fromId: category.id, toId: NO_CATEGORY })}
                        >
                          <ArrowRightLeft className="size-4" /> Move books
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDraft(category)} disabled={busy}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={busy}
                          onClick={() => deleteCategory(category)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit category' : 'Add category'}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <Field label="Name">
                <Input value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Sort order">
                <Input
                  type="number"
                  value={String(draft.sort_order ?? 999)}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button disabled={busy} onClick={saveCategory}>{busy ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveDraft} onOpenChange={(open) => !open && setMoveDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move books to another category</DialogTitle>
          </DialogHeader>
          {moveDraft && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This updates every book currently in this category.
              </p>
              <Field label="Move to">
                <Select
                  value={moveDraft.toId}
                  onValueChange={(value) => setMoveDraft({ ...moveDraft, toId: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                    {(categories ?? [])
                      .filter((category) => category.id !== moveDraft.fromId)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveDraft(null)}>Cancel</Button>
            <Button disabled={busy} onClick={moveBooks}>{busy ? 'Moving...' : 'Move books'}</Button>
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
