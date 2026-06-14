import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Database } from './database.types'
import { addDays, format } from 'date-fns'

export type ItemStatus = Database['public']['Enums']['reservation_item_status']

const today = () => format(new Date(), 'yyyy-MM-dd')

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: async () => {
      const t = today()
      const soon = format(addDays(new Date(), 3), 'yyyy-MM-dd')

      // Fetch the small working sets and count client-side (robust vs head-count).
      const [openLoans, pendingItems] = await Promise.all([
        supabase.from('loans').select('due_date').is('date_returned', null),
        supabase.from('reservation_items').select('id').eq('status', 'pending'),
      ])
      if (openLoans.error) throw openLoans.error
      if (pendingItems.error) throw pendingItems.error

      const loans = openLoans.data ?? []
      return {
        pending: pendingItems.data?.length ?? 0,
        out: loans.length,
        overdue: loans.filter((l) => l.due_date < t).length,
        dueSoon: loans.filter((l) => l.due_date >= t && l.due_date <= soon).length,
      }
    },
  })
}

export interface QueueItem {
  id: string
  status: ItemStatus
  bookTitle: string
}
export interface QueueRow {
  id: string
  name: string
  email: string
  member_id: string | null
  created_at: string
  pickup_time: string | null
  finalized_at: string | null
  items: QueueItem[]
  pendingCount: number
}

export function useReservationsQueue() {
  return useQuery({
    queryKey: ['admin', 'reservations'],
    queryFn: async (): Promise<QueueRow[]> => {
      const { data, error } = await supabase
        .from('reservations')
        .select(
          'id, name, email, member_id, created_at, pickup_time, finalized_at, reservation_items(id, status, books(title))',
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => {
        const items = (r.reservation_items ?? []).map((it) => ({
          id: it.id,
          status: it.status,
          bookTitle: (it.books as { title: string } | null)?.title ?? 'Unknown',
        }))
        return {
          id: r.id,
          name: r.name,
          email: r.email,
          member_id: r.member_id,
          created_at: r.created_at,
          pickup_time: r.pickup_time,
          finalized_at: r.finalized_at,
          items,
          pendingCount: items.filter((i) => i.status === 'pending').length,
        }
      })
    },
  })
}

export interface DetailItem {
  id: string
  status: ItemStatus
  book_id: string
  title: string
  author: string | null
  cover_path: string | null
  description: string | null
  pages: number | null
  isAvailable: boolean
  expectedReturn: string | null
}
export interface ReservationDetail {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  member_id: string | null
  pickup_time: string | null
  comments: string | null
  admin_note: string | null
  created_at: string
  finalized_at: string | null
  items: DetailItem[]
}

export function useReservationDetail(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['admin', 'reservation', id],
    queryFn: async (): Promise<ReservationDetail | null> => {
      const { data, error } = await supabase
        .from('reservations')
        .select(
          'id, name, email, phone, address, member_id, pickup_time, comments, admin_note, created_at, finalized_at, reservation_items(id, status, book_id, books(title, author, cover_path, description, pages))',
        )
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null

      const bookIds = (data.reservation_items ?? []).map((i) => i.book_id)
      const { data: avail } = await supabase
        .from('book_availability')
        .select('book_id, is_available, expected_return')
        .in('book_id', bookIds)
      const availMap = new Map((avail ?? []).map((a) => [a.book_id, a]))

      return {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        member_id: data.member_id,
        pickup_time: data.pickup_time,
        comments: data.comments,
        admin_note: data.admin_note,
        created_at: data.created_at,
        finalized_at: data.finalized_at,
        items: (data.reservation_items ?? []).map((it) => {
          const b = it.books as {
            title: string
            author: string | null
            cover_path: string | null
            description: string | null
            pages: number | null
          } | null
          const a = availMap.get(it.book_id)
          return {
            id: it.id,
            status: it.status,
            book_id: it.book_id,
            title: b?.title ?? 'Unknown',
            author: b?.author ?? null,
            cover_path: b?.cover_path ?? null,
            description: b?.description ?? null,
            pages: b?.pages ?? null,
            isAvailable: a?.is_available ?? true,
            expectedReturn: a?.expected_return ?? null,
          }
        }),
      }
    },
  })
}
