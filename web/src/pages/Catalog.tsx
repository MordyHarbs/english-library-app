import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { BookCard } from '@/components/BookCard'
import { BookDialog } from '@/components/BookDialog'
import { useBooks, useAvailability, useCategories } from '@/lib/queries'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function Catalog() {
  const { data: books, isLoading } = useBooks()
  const { data: availability } = useAvailability()
  const { data: categories } = useCategories()

  const [search, setSearch] = useState('')
  const [cats, setCats] = useState<Set<string>>(new Set())
  const [avail, setAvail] = useState('all')
  const [openBook, setOpenBook] = useState<string | null>(null)

  const toggleCat = (id: string) =>
    setCats((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const filtered = useMemo(() => {
    if (!books) return []
    const q = search.trim().toLowerCase()
    return books.filter((b) => {
      if (cats.size > 0 && (!b.category_id || !cats.has(b.category_id))) return false
      if (avail !== 'all') {
        const isAvail = availability?.[b.id]?.is_available ?? true
        if (avail === 'available' && !isAvail) return false
        if (avail === 'out' && isAvail) return false
      }
      if (q) {
        const hay = `${b.title} ${b.author ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [books, availability, search, cats, avail])

  return (
    <AppShell>
      <div className="mb-8 border-b pb-6">
        <p className="eyebrow">The collection</p>
        <h1 className="mt-2 text-4xl font-medium tracking-tight sm:text-5xl">
          Browse the catalog
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Add the books you'd like, then send a request. No account needed — logging
          in just lets you follow along.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or author…"
            className="pl-9"
          />
        </div>
        <Select value={avail} onValueChange={setAvail}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All books</SelectItem>
            <SelectItem value="available">Available now</SelectItem>
            <SelectItem value="out">Checked out</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Category chips (multi-select) */}
      {categories && categories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = cats.has(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggleCat(c.id)}
                className={
                  'rounded-full border px-3 py-1 text-sm transition-colors ' +
                  (active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-transparent hover:bg-secondary')
                }
              >
                {c.name}
              </button>
            )
          })}
          {cats.size > 0 && (
            <button
              onClick={() => setCats(new Set())}
              className="rounded-full px-3 py-1 text-sm text-muted-foreground underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <p className="py-16 text-center text-muted-foreground">Loading catalog…</p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          No books match your filters.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {filtered.length} book{filtered.length === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                availability={availability?.[book.id]}
                onOpen={setOpenBook}
              />
            ))}
          </div>
        </>
      )}

      <BookDialog bookId={openBook} onClose={() => setOpenBook(null)} />
    </AppShell>
  )
}
