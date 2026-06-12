import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Check, Plus } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { AvailabilityBadge } from '@/components/AvailabilityBadge'
import { useBook, useAvailability } from '@/lib/queries'
import { coverUrl } from '@/lib/covers'
import { useCart } from '@/lib/cart'
import { Button } from '@/components/ui/button'

export default function BookDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: book, isLoading } = useBook(id)
  const { data: availability } = useAvailability()
  const { has, toggle } = useCart()

  if (isLoading) {
    return (
      <AppShell>
        <p className="py-16 text-center text-muted-foreground">Loading…</p>
      </AppShell>
    )
  }

  if (!book) {
    return (
      <AppShell>
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Book not found.</p>
          <Link to="/" className="mt-2 inline-block underline">
            Back to catalog
          </Link>
        </div>
      </AppShell>
    )
  }

  const cover = coverUrl(book.cover_path)
  const inCart = has(book.id)

  return (
    <AppShell>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-lg border bg-muted">
          <div className="aspect-[2/3] w-full">
            {cover ? (
              <img src={cover} alt={book.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <BookOpen className="size-10 opacity-40" />
              </div>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{book.title}</h1>
          {book.author && (
            <p className="mt-1 text-lg text-muted-foreground">{book.author}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <AvailabilityBadge availability={availability?.[book.id]} />
            {book.categoryName && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {book.categoryName}
              </span>
            )}
            {book.pages ? (
              <span className="text-xs text-muted-foreground">{book.pages} pages</span>
            ) : null}
          </div>

          {book.description && (
            <p className="mt-5 max-w-prose leading-relaxed text-foreground/90">
              {book.description}
            </p>
          )}

          <Button
            size="lg"
            variant={inCart ? 'secondary' : 'default'}
            className="mt-6"
            onClick={() =>
              toggle({
                id: book.id,
                title: book.title,
                author: book.author,
                cover_path: book.cover_path,
              })
            }
          >
            {inCart ? (
              <>
                <Check className="size-4" /> Added to request
              </>
            ) : (
              <>
                <Plus className="size-4" /> Add to request
              </>
            )}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
