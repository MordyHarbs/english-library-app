import { Routes, Route } from 'react-router-dom'
import { RequireAuth, RequireAdmin } from '@/components/guards'
import Login from '@/pages/Login'
import Catalog from '@/pages/Catalog'
import BookDetail from '@/pages/BookDetail'
import Reserve from '@/pages/Reserve'

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
      <Route path="/account/books" element={<RequireAuth><Placeholder title="My books" /></RequireAuth>} />
      <Route path="/account/requests" element={<RequireAuth><Placeholder title="My requests" /></RequireAuth>} />
      <Route path="/account/history" element={<RequireAuth><Placeholder title="My history" /></RequireAuth>} />
      <Route path="/account/details" element={<RequireAuth><Placeholder title="My details" /></RequireAuth>} />

      {/* Admin */}
      <Route path="/admin" element={<RequireAdmin><Placeholder title="Admin overview" /></RequireAdmin>} />
      <Route path="/admin/reservations" element={<RequireAdmin><Placeholder title="Reservations queue" /></RequireAdmin>} />
      <Route path="/admin/reservations/:id" element={<RequireAdmin><Placeholder title="Reservation detail" /></RequireAdmin>} />
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
