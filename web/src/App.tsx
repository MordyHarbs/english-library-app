import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { RequireAuth, RequireAdmin } from '@/components/guards'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DEFAULT_PUBLIC_SETTINGS, useActiveAppNotices, usePublicSettings } from '@/lib/queries'
// Public pages load eagerly (the landing experience).
import Catalog from '@/pages/Catalog'
import BookDetail from '@/pages/BookDetail'
import Reserve from '@/pages/Reserve'
import Login from '@/pages/Login'

// Account + admin are code-split out of the initial bundle.
const MyBooks = lazy(() => import('@/pages/account/MyBooks'))
const MyRequests = lazy(() => import('@/pages/account/MyRequests'))
const MyHistory = lazy(() => import('@/pages/account/MyHistory'))
const MyDetails = lazy(() => import('@/pages/account/MyDetails'))
const AdminOverview = lazy(() => import('@/pages/admin/Overview'))
const AdminReservations = lazy(() => import('@/pages/admin/Reservations'))
const AdminReservationDetail = lazy(() => import('@/pages/admin/ReservationDetail'))
const AdminWorkbench = lazy(() => import('@/pages/admin/Workbench'))
const AdminBooks = lazy(() => import('@/pages/admin/Books'))
const AdminCategories = lazy(() => import('@/pages/admin/Categories'))
const AdminMembers = lazy(() => import('@/pages/admin/Members'))
const AdminMemberDetail = lazy(() => import('@/pages/admin/MemberDetail'))
const AdminLoans = lazy(() => import('@/pages/admin/Loans'))
const AdminHistory = lazy(() => import('@/pages/admin/History'))
const AdminSettings = lazy(() => import('@/pages/admin/Settings'))
const AdminCatalogPrint = lazy(() => import('@/pages/admin/CatalogPrint'))

const DISMISSED_APP_NOTICES_KEY = 'english-library-dismissed-app-notices'

function readDismissedNoticeTokens() {
  try {
    const raw = window.localStorage.getItem(DISMISSED_APP_NOTICES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return Object.fromEntries(
      Object.entries(parsed).map(([id, token]) => [id, String(token)]),
    )
  } catch {
    return {}
  }
}

function writeDismissedNoticeTokens(tokens: Record<string, string>) {
  window.localStorage.setItem(DISMISSED_APP_NOTICES_KEY, JSON.stringify(tokens))
}

function noticeDismissalToken(notice: { dismissal_version: number; title: string; body: string }) {
  return `${notice.dismissal_version}:${notice.title.trim()}:${notice.body.trim()}`
}

/**
 * Route skeleton — mirrors TECH-PLAN D4.
 */
function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">Coming soon — scaffolding in place.</p>
    </div>
  )
}

function AppNotification() {
  const { data: notices } = useActiveAppNotices()
  const [open, setOpen] = useState(false)
  const [shownMessageKey, setShownMessageKey] = useState<string | null>(null)
  const [neverShowAgain, setNeverShowAgain] = useState(false)
  const [dismissedTokens, setDismissedTokens] = useState<Record<string, string>>(() =>
    readDismissedNoticeTokens(),
  )

  const activeNotices = notices ?? []
  const visibleNotices = activeNotices.filter(
    (notice) => dismissedTokens[notice.id] !== noticeDismissalToken(notice),
  )
  const messageKey = visibleNotices
    .map((notice) => `${notice.id}:${notice.dismissal_version}:${notice.title.trim()}:${notice.body.trim()}`)
    .join('\n')
  const hasVisibleNotices = visibleNotices.length > 0

  useEffect(() => {
    if (hasVisibleNotices && shownMessageKey !== messageKey) {
      setOpen(true)
      setNeverShowAgain(false)
      setShownMessageKey(messageKey)
    }
  }, [hasVisibleNotices, messageKey, shownMessageKey])

  if (!hasVisibleNotices) return null

  const singleNotice = visibleNotices.length === 1 ? visibleNotices[0] : null

  function closeNotice() {
    if (neverShowAgain) {
      const nextDismissedTokens = { ...dismissedTokens }
      for (const notice of visibleNotices) {
        nextDismissedTokens[notice.id] = noticeDismissalToken(notice)
      }
      writeDismissedNoticeTokens(nextDismissedTokens)
      setDismissedTokens(nextDismissedTokens)
    }
    setOpen(false)
    setNeverShowAgain(false)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : closeNotice()}>
      <DialogContent className="flex max-h-[min(90dvh,42rem)] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {singleNotice ? singleNotice.title.trim() || 'Library notice' : 'Library notices'}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-left">
          {singleNotice?.body.trim() ? (
            <DialogDescription className="break-words whitespace-pre-line leading-relaxed text-foreground/80">
              {singleNotice.body.trim()}
            </DialogDescription>
          ) : null}
          {!singleNotice && (
            <div className="space-y-4">
              {visibleNotices.map((notice) => (
                <section key={notice.id} className="space-y-1.5">
                  <h3 className="break-words text-sm font-medium leading-snug">
                    {notice.title.trim() || 'Library notice'}
                  </h3>
                  {notice.body.trim() && (
                    <p className="break-words whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {notice.body.trim()}
                    </p>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 items-start border-t pt-4 sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={neverShowAgain}
              onChange={(event) => setNeverShowAgain(event.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Never show again
          </label>
          <DialogClose asChild>
            <Button>Got it</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BrandingEffects() {
  const { data: publicSettings } = usePublicSettings()
  const branding = publicSettings ?? DEFAULT_PUBLIC_SETTINGS

  useEffect(() => {
    document.title = branding.library_name
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!icon) {
      icon = document.createElement('link')
      icon.rel = 'icon'
      document.head.appendChild(icon)
    }
    icon.href = branding.library_icon_url
  }, [branding.library_icon_url, branding.library_name])

  return null
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
    <>
      <BrandingEffects />
      <AppNotification />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Catalog />} />
        <Route path="/books/:id" element={<BookDetail />} />
        <Route path="/reserve" element={<Reserve />} />
        <Route path="/login" element={<Login />} />

        {/* Member portal */}
        <Route path="/account/books" element={<RequireAuth><MyBooks /></RequireAuth>} />
        <Route path="/account/requests" element={<RequireAuth><MyRequests /></RequireAuth>} />
        <Route path="/account/history" element={<RequireAuth><MyHistory /></RequireAuth>} />
        <Route path="/account/details" element={<RequireAuth><MyDetails /></RequireAuth>} />

        {/* Admin */}
        <Route path="/admin" element={<RequireAdmin><AdminOverview /></RequireAdmin>} />
        <Route path="/admin/reservations" element={<RequireAdmin><AdminReservations /></RequireAdmin>} />
        <Route path="/admin/reservations/:id" element={<RequireAdmin><AdminReservationDetail /></RequireAdmin>} />
        <Route path="/admin/workbench" element={<RequireAdmin><AdminWorkbench /></RequireAdmin>} />
        <Route path="/admin/books" element={<RequireAdmin><AdminBooks /></RequireAdmin>} />
        <Route path="/admin/categories" element={<RequireAdmin><AdminCategories /></RequireAdmin>} />
        <Route path="/admin/members" element={<RequireAdmin><AdminMembers /></RequireAdmin>} />
        <Route path="/admin/members/:id" element={<RequireAdmin><AdminMemberDetail /></RequireAdmin>} />
        <Route path="/admin/loans" element={<RequireAdmin><AdminLoans /></RequireAdmin>} />
        <Route path="/admin/history" element={<RequireAdmin><AdminHistory /></RequireAdmin>} />
        <Route path="/admin/settings" element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
        <Route path="/admin/catalog-print" element={<RequireAdmin><AdminCatalogPrint /></RequireAdmin>} />

        <Route path="*" element={<Placeholder title="Not found" />} />
      </Routes>
    </>
    </Suspense>
  )
}
