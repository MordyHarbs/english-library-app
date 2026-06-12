import { Routes, Route } from 'react-router-dom'
import { RequireAuth, RequireAdmin } from '@/components/guards'
import Login from '@/pages/Login'
import Catalog from '@/pages/Catalog'
import BookDetail from '@/pages/BookDetail'
import Reserve from '@/pages/Reserve'
import MyBooks from '@/pages/account/MyBooks'
import MyRequests from '@/pages/account/MyRequests'
import MyHistory from '@/pages/account/MyHistory'
import MyDetails from '@/pages/account/MyDetails'
import AdminOverview from '@/pages/admin/Overview'
import AdminReservations from '@/pages/admin/Reservations'
import AdminReservationDetail from '@/pages/admin/ReservationDetail'

/**
 * Route skeleton — mirrors TECH-PLAN D4.
 * Pages are placeholders for now; each phase fills them in.
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
      <Route path="/admin/workbench" element={<RequireAdmin><Placeholder title="Lend / Return workbench" /></RequireAdmin>} />
      <Route path="/admin/books" element={<RequireAdmin><Placeholder title="Manage books" /></RequireAdmin>} />
      <Route path="/admin/members" element={<RequireAdmin><Placeholder title="Manage members" /></RequireAdmin>} />
      <Route path="/admin/loans" element={<RequireAdmin><Placeholder title="Open loans" /></RequireAdmin>} />
      <Route path="/admin/history" element={<RequireAdmin><Placeholder title="Lending history" /></RequireAdmin>} />
      <Route path="/admin/settings" element={<RequireAdmin><Placeholder title="Settings" /></RequireAdmin>} />
      <Route path="/admin/catalog-print" element={<RequireAdmin><Placeholder title="Catalog (print)" /></RequireAdmin>} />

      <Route path="*" element={<Placeholder title="Not found" />} />
    </Routes>
  )
}
