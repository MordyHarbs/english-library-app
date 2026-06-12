import { BookOpen } from 'lucide-react'
import { coverUrl } from '@/lib/covers'

/** Small cover thumbnail with a fallback icon. */
export function BookThumb({
  cover_path,
  title,
  className = 'h-20 w-14',
}: {
  cover_path: string | null
  title: string
  className?: string
}) {
  const cover = coverUrl(cover_path)
  return (
    <div className={`${className} shrink-0 overflow-hidden rounded bg-muted`}>
      {cover ? (
        <img src={cover} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <BookOpen className="size-5 opacity-40" />
        </div>
      )}
    </div>
  )
}
