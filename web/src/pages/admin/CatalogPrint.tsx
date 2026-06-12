import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { useBooks, useCategories } from '@/lib/queries'
import { Button } from '@/components/ui/button'

export default function CatalogPrint() {
  const { data: books } = useBooks()
  const { data: categories } = useCategories()

  const grouped = useMemo(() => {
    const byCat = new Map<string, typeof books>()
    for (const b of books ?? []) {
      const key = b.categoryName ?? 'Uncategorized'
      byCat.set(key, [...(byCat.get(key) ?? []), b])
    }
    const order = (categories ?? []).map((c) => c.name)
    return [...byCat.entries()].sort(
      (a, b) => (order.indexOf(a[0]) + 1 || 999) - (order.indexOf(b[0]) + 1 || 999),
    )
  }, [books, categories])

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Screen-only toolbar */}
      <div className="mb-8 flex items-center justify-between print:hidden">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to admin
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> Print / Save as PDF
        </Button>
      </div>

      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl font-medium">Ayalot Library</h1>
        <p className="text-sm text-muted-foreground">Catalog</p>
      </header>

      {grouped.map(([cat, list]) => (
        <section key={cat} className="mb-6 break-inside-avoid">
          <h2 className="font-display mb-2 border-b pb-1 text-lg font-medium">{cat}</h2>
          <ul className="space-y-1">
            {(list ?? []).map((b) => (
              <li key={b.id} className="flex justify-between gap-4 text-sm">
                <span>
                  <span className="font-medium">{b.title}</span>
                  {b.author && <span className="text-muted-foreground"> — {b.author}</span>}
                </span>
                {b.pages ? <span className="text-muted-foreground">{b.pages}p</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
