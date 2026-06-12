import { useNavigate } from 'react-router-dom'
import { BookOpen, Check, Plus } from 'lucide-react'
import type { CatalogBook, Availability } from '@/lib/queries'
import { coverUrl } from '@/lib/covers'
import { useCart } from '@/lib/cart'
import { AvailabilityBadge } from './AvailabilityBadge'
import { cn } from '@/lib/utils'

export function BookCard({
  book,
  availability,
}: {
  book: CatalogBook
  availability: Availability | undefined
}) {
  const navigate = useNavigate()
  const { has, toggle } = useCart()
  const inCart = has(book.id)
  const cover = coverUrl(book.cover_path)

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md">
      <button
        onClick={() => navigate(`/books/${book.id}`)}
        className="relative aspect-[2/3] w-full overflow-hidden bg-muted text-left"
        aria-label={`View ${book.title}`}
      >
        {cover ? (
          <img
            src={cover}
            alt={book.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
            <BookOpen className="size-8 opacity-40" />
            <span className="text-sm font-medium">{book.title}</span>
          </div>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex-1">
          <button
            onClick={() => navigate(`/books/${book.id}`)}
            className="font-display line-clamp-2 text-left text-[0.95rem] font-medium leading-snug hover:underline"
          >
            {book.title}
          </button>
          {book.author && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {book.author}
            </p>
          )}
        </div>

        <AvailabilityBadge availability={availability} />

        <button
          onClick={() =>
            toggle({
              id: book.id,
              title: book.title,
              author: book.author,
              cover_path: book.cover_path,
            })
          }
          className={cn(
            'mt-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
            inCart
              ? 'bg-primary text-primary-foreground'
              : 'border border-input bg-transparent text-foreground hover:bg-secondary',
          )}
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
        </button>
      </div>
    </div>
  )
}
