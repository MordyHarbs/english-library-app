import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { AppShell } from './AppShell'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/account/books', label: 'My books' },
  { to: '/account/requests', label: 'Requests' },
  { to: '/account/history', label: 'History' },
  { to: '/account/details', label: 'Details' },
]

export function AccountShell({ children }: { children: ReactNode }) {
  const { member, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight">
            {member?.name ?? 'My account'}
          </h1>
        </div>
        <button
          onClick={async () => {
            await signOut()
            navigate('/')
          }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>

      <nav className="mb-6 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              cn(
                'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      {children}
    </AppShell>
  )
}
