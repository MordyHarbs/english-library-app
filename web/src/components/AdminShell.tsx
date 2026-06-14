import type { ReactNode } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
  ArrowLeftRight,
  BookMarked,
  Users,
  BookCopy,
  History,
  Settings,
  Library,
  LogOut,
  ChevronLeft,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/reservations', label: 'Reservations', icon: Inbox },
  { to: '/admin/workbench', label: 'Lend / Return', icon: ArrowLeftRight },
  { to: '/admin/books', label: 'Books', icon: BookMarked },
  { to: '/admin/members', label: 'Members', icon: Users },
  { to: '/admin/loans', label: 'Loans', icon: BookCopy },
  { to: '/admin/history', label: 'History', icon: History },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export function AdminShell({
  title,
  actions,
  children,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
}) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Sidebar (lg+) / horizontal scroller (smaller) */}
      <aside className="sticky top-0 z-20 shrink-0 border-b bg-card lg:h-screen lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <Library className="size-5 text-accent" />
          <Link to="/admin" className="font-display text-lg font-medium tracking-tight">
            Ayalot Admin
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )
              }
            >
              <n.icon className="size-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-2 lg:absolute lg:bottom-3 lg:block lg:w-full">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/60"
          >
            <Library className="size-4" /> Public site
          </Link>
          <button
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/60"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              to="/"
              className="mb-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" /> Back to public site
            </Link>
            <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  )
}
