import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Library, ShoppingBag, UserRound, LayoutDashboard } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { useAuth } from '@/lib/auth'

export function AppShell({ children }: { children: ReactNode }) {
  const { count } = useCart()
  const { session, isAdmin } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Library className="size-5 text-accent" />
            <span className="text-lg tracking-tight">Ayalot Library</span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            {isAdmin && (
              <Link
                to="/admin"
                className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground sm:inline-flex"
              >
                <LayoutDashboard className="size-4" /> Admin
              </Link>
            )}

            <button
              onClick={() => navigate('/reserve')}
              className="relative inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium hover:bg-secondary"
              aria-label="View your request"
            >
              <ShoppingBag className="size-4" />
              <span className="hidden sm:inline">Request</span>
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {count}
                </span>
              )}
            </button>

            {session ? (
              <Link
                to="/account/books"
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:opacity-90"
              >
                <UserRound className="size-4" />
                <span className="hidden sm:inline">My account</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex h-10 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Log in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Ayalot Library
      </footer>
    </div>
  )
}
