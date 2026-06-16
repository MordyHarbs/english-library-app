import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { RequireAuth, RequireAdmin } from '@/components/guards'
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

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
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
    </Suspense>
  )
}
