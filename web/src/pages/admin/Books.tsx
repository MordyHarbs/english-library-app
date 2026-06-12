import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import imageCompression from 'browser-image-compression'
import { Plus, Pencil, BookOpen } from 'lucide-react'
import { AdminShell } from '@/components/AdminShell'
import { useBooks, useCategories, type CatalogBook } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { coverUrl } from '@/lib/covers'
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

type Draft = Partial<CatalogBook> & { id?: string; categoryName?: string | null }

export default function Books() {
  const { data: books, isLoading } = useBooks()
  const { data: categories } = useCategories()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (books ?? []).filter(
      (b) => !q || `${b.title} ${b.author ?? ''}`.toLowerCase().includes(q),
    )
  }, [books, search])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['books'] })
    qc.invalidateQueries({ queryKey: ['categories'] })
  }

  async function resolveCategory(name: string | null | undefined): Promise<string | null> {
    const n = (name ?? '').trim()
    if (!n) return null
    const existing = categories?.find((c) => c.name.toLowerCase() === n.toLowerCase())
    if (existing) return existing.id
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: n })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }

  async function uploadCover(bookId: string, file: File) {
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 600,
      maxSizeMB: 0.1,
      useWebWorker: true,
      fileType: 'image/jpeg',
    })
    const path = `${bookId}.jpg`
    const { error } = await supabase.storage
      .from('covers')
      .upload(path, compressed, { contentType: 'image/jpeg', upsert: true })
    if (error) throw error
    await supabase.from('books').update({ cover_path: path }).eq('id', bookId)
  }

  async function save() {
    if (!draft?.title?.trim()) return toast.error('Title is required')
    setBusy(true)
    try {
      const category_id = await resolveCategory(draft.categoryName)
      const payload = {
        title: draft.title.trim(),
        author: draft.author || null,
        category_id,
        description: draft.description || null,
        pages: draft.pages ? Number(draft.pages) : null,
        comments: draft.comments || null,
      }
      let bookId = draft.id
      if (bookId) {
        const { error } = await supabase.from('books').update(payload).eq('id', bookId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('books').insert(payload).select('id').single()
        if (error) throw error
        bookId = data.id
      }
      if (coverFile && bookId) await uploadCover(bookId, coverFile)
      toast.success(draft.id ? 'Book updated.' : 'Book added.')
      setDraft(null)
      setCoverFile(null)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell
      title="Books"
      actions={
        <Button onClick={() => setDraft({})}>
          <Plus className="size-4" /> Add book
        </Button>
      }
    >
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search books…"
        className="mb-4 sm:max-w-xs"
      />

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rows.map((b) => {
            const cover = coverUrl(b.cover_path)
            return (
              <div key={b.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
                  {cover ? (
                    <img src={cover} alt={b.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <BookOpen className="size-4 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {b.author}
                    {b.categoryName ? ` · ${b.categoryName}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft({ ...b })
                    setCoverFile(null)
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <Dialog
        open={!!draft}
        onOpenChange={(o) => {
          if (!o) {
            setDraft(null)
            setCoverFile(null)
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit book' : 'Add book'}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <Field label="Title">
                <Input value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Author">
                  <Input value={draft.author ?? ''} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
                </Field>
                <Field label="Pages">
                  <Input
                    type="number"
                    value={draft.pages ? String(draft.pages) : ''}
                    onChange={(e) => setDraft({ ...draft, pages: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <Field label="Category">
                <Input
                  list="cat-list"
                  value={draft.categoryName ?? ''}
                  onChange={(e) => setDraft({ ...draft, categoryName: e.target.value })}
                  placeholder="Type or pick a category"
                />
                <datalist id="cat-list">
                  {categories?.map((c) => <option key={c.id} value={c.name} />)}
                </datalist>
              </Field>
              <Field label="Description">
                <textarea
                  rows={3}
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>
              <Field label="Admin notes">
                <Input value={draft.comments ?? ''} onChange={(e) => setDraft({ ...draft, comments: e.target.value })} />
              </Field>
              <Field label="Cover image">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
                {coverFile && <p className="text-xs text-muted-foreground">{coverFile.name}</p>}
              </Field>
              {/* Future: a "Get book info" button slots in here (TECH-PLAN §12). */}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(null)
                setCoverFile(null)
              }}
            >
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
