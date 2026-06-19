import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import imageCompression from 'browser-image-compression'
import { Plus, Pencil, BookOpen, Trash2, Link, ImageOff } from 'lucide-react'
import { AdminShell } from '@/components/AdminShell'
import { BookDialog } from '@/components/BookDialog'
import { useBooks, useCategories, type CatalogBook } from '@/lib/queries'
import { useOpenLoans } from '@/lib/manage'
import { fmtDate } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { coverUrl } from '@/lib/covers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { callFunction } from '@/lib/functions'
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

type Draft = Partial<CatalogBook> & { id?: string; categoryName?: string | null }
const NEW_CATEGORY = '__new__'
const NO_CATEGORY = '__none__'

interface ImportedBookDetails {
  title: string
  author: string | null
  description: string | null
  pages: number | null
  category: string | null
  cover: {
    filename: string
    content_type: string
    data_base64: string
  } | null
}

export default function Books() {
  const { data: books, isLoading } = useBooks()
  const { data: categories } = useCategories()
  const { data: openLoans } = useOpenLoans()
  const qc = useQueryClient()
  const loanByBook = useMemo(
    () => new Map((openLoans ?? []).map((l) => [l.book_id, l])),
    [openLoans],
  )
  const [outInfo, setOutInfo] = useState<{ title: string; member: string; due: string } | null>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverRemoved, setCoverRemoved] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [openBook, setOpenBook] = useState<string | null>(null)

  const nextSerialNumber = useMemo(() => {
    const max = Math.max(0, ...(books ?? []).map((b) => Number(b.serial_number ?? 0)))
    return max + 1
  }, [books])
  const coverPreview = useMemo(() => {
    if (!draft || coverRemoved) return null
    if (coverFile) return URL.createObjectURL(coverFile)
    return coverUrl(draft.cover_path)
  }, [coverFile, coverRemoved, draft?.cover_path])

  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview)
    }
  }, [coverPreview])

  async function deleteBook(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return
    const { error } = await supabase.from('books').delete().eq('id', id)
    if (error) {
      toast.error(
        /foreign key|violates/i.test(error.message)
          ? "Can't delete — this book has loan or request history."
          : error.message,
      )
      return
    }
    toast.success('Book deleted.')
    qc.invalidateQueries({ queryKey: ['books'] })
  }

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

  async function removeCover(path: string | null | undefined) {
    if (!path) return
    const { error } = await supabase.storage.from('covers').remove([path])
    if (error && !/not found|does not exist/i.test(error.message)) throw error
  }

  function newBookDraft(importUrl = '') {
    setDraft({ serial_number: nextSerialNumber })
    setCoverFile(null)
    setCoverRemoved(false)
    setImportUrl(importUrl)
  }

  function categoryDraft(category: string | null | undefined) {
    const name = (category ?? '').trim()
    if (!name) return { category_id: null, categoryName: null }
    const existing = categories?.find((c) => c.name.toLowerCase() === name.toLowerCase())
    return existing ? { category_id: existing.id, categoryName: null } : { category_id: null, categoryName: name }
  }

  async function importBookDetails() {
    if (!importUrl.trim()) return toast.error('Paste a Goodreads or Amazon link')
    setImportBusy(true)
    try {
      const imported = await callFunction<ImportedBookDetails>('import-goodreads-book', { url: importUrl.trim() })
      const nextDraft = draft ?? { serial_number: nextSerialNumber }
      setDraft({
        ...nextDraft,
        title: imported.title || nextDraft.title,
        author: imported.author ?? nextDraft.author ?? null,
        description: imported.description ?? nextDraft.description ?? null,
        pages: imported.pages ?? nextDraft.pages ?? null,
        ...categoryDraft(imported.category),
      })
      if (imported.cover) {
        setCoverFile(fileFromBase64(imported.cover))
        setCoverRemoved(false)
      }
      toast.success('Book details filled in.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setImportBusy(false)
    }
  }

  async function save() {
    if (!draft?.title?.trim()) return toast.error('Title is required')
    if (!draft.serial_number || Number(draft.serial_number) < 1) {
      return toast.error('Serial number is required')
    }
    setBusy(true)
    try {
      const category_id = draft.category_id ?? await resolveCategory(draft.categoryName)
      const payload = {
        title: draft.title.trim(),
        author: draft.author || null,
        category_id,
        description: draft.description || null,
        pages: draft.pages ? Number(draft.pages) : null,
        serial_number: Number(draft.serial_number),
        comments: draft.comments || null,
        ...(coverRemoved && !coverFile ? { cover_path: null } : {}),
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
      if (coverRemoved && !coverFile) await removeCover(draft.cover_path)
      if (coverFile && bookId) await uploadCover(bookId, coverFile)
      toast.success(draft.id ? 'Book updated.' : 'Book added.')
      setDraft(null)
      setCoverFile(null)
      setCoverRemoved(false)
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
        <Button onClick={() => newBookDraft()}>
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
                <button
                  onClick={() => setOpenBook(b.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
                    {cover ? (
                      <img src={cover} alt={b.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <BookOpen className="size-4 opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium hover:underline">{b.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      #{b.serial_number}
                      {b.author ? ` · ${b.author}` : ''}
                      {b.categoryName ? ` · ${b.categoryName}` : ''}
                    </p>
                  </div>
                </button>
                {(() => {
                  const loan = loanByBook.get(b.id)
                  return loan ? (
                    <button
                      onClick={() =>
                        setOutInfo({ title: b.title, member: loan.memberName, due: loan.due_date })
                      }
                      className="shrink-0 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning hover:bg-warning/25"
                    >
                      Out
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-success/12 px-2.5 py-0.5 text-xs font-medium text-success">
                      Available
                    </span>
                  )
                })()}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Edit"
                  onClick={() => {
                    setDraft({ ...b })
                    setCoverFile(null)
                    setCoverRemoved(false)
                    setImportUrl('')
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Delete"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteBook(b.id, b.title)}
                >
                  <Trash2 className="size-4" />
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
            setCoverRemoved(false)
            setImportUrl('')
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit book' : 'Add book'}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              {!draft.id && (
                <div className="rounded-lg border bg-secondary/30 p-3">
                  <div className="flex flex-col gap-2 md:flex-row">
                    <Input
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="Goodreads or Amazon link"
                      className="min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={importBusy}
                      onClick={importBookDetails}
                      className="w-full md:w-auto"
                    >
                      <Link className="size-4" /> {importBusy ? 'Filling...' : 'Fill details'}
                    </Button>
                  </div>
                </div>
              )}
              <Field label="Title">
                <Input value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Author">
                  <Input value={draft.author ?? ''} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
                </Field>
                <Field label="Serial number">
                  <Input
                    type="number"
                    min={1}
                    value={draft.serial_number ? String(draft.serial_number) : ''}
                    onChange={(e) => setDraft({ ...draft, serial_number: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Pages">
                  <Input
                    type="number"
                    value={draft.pages ? String(draft.pages) : ''}
                    onChange={(e) => setDraft({ ...draft, pages: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Category">
                  <Select
                    value={draft.category_id ?? (draft.categoryName ? NEW_CATEGORY : NO_CATEGORY)}
                    onValueChange={(value) => {
                      if (value === NO_CATEGORY) setDraft({ ...draft, category_id: null, categoryName: null })
                      else if (value === NEW_CATEGORY) setDraft({ ...draft, category_id: null, categoryName: '' })
                      else setDraft({ ...draft, category_id: value, categoryName: null })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                      {categories?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                      <SelectItem value={NEW_CATEGORY}>Add new category…</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {draft.categoryName !== null && draft.categoryName !== undefined && !draft.category_id && (
                <Field label="New category name">
                  <Input
                    value={draft.categoryName ?? ''}
                    onChange={(e) => setDraft({ ...draft, categoryName: e.target.value })}
                    placeholder="Category name"
                  />
                </Field>
              )}
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
                <div className="flex flex-col gap-3 rounded-lg border bg-secondary/20 p-3 sm:flex-row sm:items-center">
                  <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                    {coverPreview ? (
                      <img src={coverPreview} alt="Book cover preview" className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      className="w-full min-w-0"
                      onChange={(e) => {
                        setCoverFile(e.target.files?.[0] ?? null)
                        setCoverRemoved(false)
                      }}
                    />
                    {coverFile && <p className="truncate text-xs text-muted-foreground">{coverFile.name}</p>}
                    {(draft.cover_path || coverFile) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setCoverFile(null)
                          setCoverRemoved(true)
                        }}
                      >
                        Remove image
                      </Button>
                    )}
                  </div>
                </div>
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(null)
                setCoverFile(null)
                setCoverRemoved(false)
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

      <BookDialog bookId={openBook} onClose={() => setOpenBook(null)} allowAdd={false} />

      <Dialog open={!!outInfo} onOpenChange={(o) => !o && setOutInfo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{outInfo?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Currently borrowed by <span className="font-medium">{outInfo?.member}</span>
            <br />
            Due {outInfo ? fmtDate(outInfo.due) : ''}
          </p>
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

function fileFromBase64(cover: ImportedBookDetails['cover']) {
  if (!cover) throw new Error('Cover is missing')
  const binary = atob(cover.data_base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], cover.filename, { type: cover.content_type })
}
