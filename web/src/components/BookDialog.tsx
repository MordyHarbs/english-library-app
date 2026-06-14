import { BookOpen, Check, Plus } from 'lucide-react'
import { useBook, useAvailability } from '@/lib/queries'
import { coverUrl } from '@/lib/covers'
import { useCart } from '@/lib/cart'
import { AvailabilityBadge } from './AvailabilityBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

/**
 * Book info as a popup overlay. Reused by the catalog and the member's requests
 * list (where it floats over the request and returns to it on close).
 */
export function BookDialog({
  bookId,
  onClose,
  allowAdd = true,
}: {
  bookId: string | null
  onClose: () => void
  allowAdd?: boolean
}) {
  const { data: book } = useBook(bookId ?? undefined)
  const { data: availability } = useAvailability()
  const { has, toggle } = useCart()
  const cover = coverUrl(book?.cover_path)
  const inCart = book ? has(book.id) : false

  return (
    <Dialog open={!!bookId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        {!book ? (
          <p className="py-8 text-center text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="mx-auto h-52 w-36 shrink-0 overflow-hidden rounded-lg border bg-muted sm:mx-0">
              {cover ? (
                <img src={cover} alt={book.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <BookOpen className="size-8 opacity-40" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-medium leading-tight">{book.title}</h2>
              {book.author && <p className="text-muted-foreground">{book.author}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
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
                <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                  {book.description}
                </p>
              )}
              {allowAdd && (
                <Button
                  className="mt-4"
                  variant={inCart ? 'secondary' : 'default'}
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
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
