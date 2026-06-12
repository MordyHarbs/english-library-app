import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { BookCard } from '@/components/BookCard'
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
  const [category, setCategory] = useState('all')
  const [avail, setAvail] = useState('all')

  const filtered = useMemo(() => {
    if (!books) return []
    const q = search.trim().toLowerCase()
    return books.filter((b) => {
      if (category !== 'all' && b.category_id !== category) return false
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
  }, [books, availability, search, category, avail])

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
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              />
            ))}
          </div>
        </>
      )}
    </AppShell>
  )
}
