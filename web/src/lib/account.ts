import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Database } from './database.types'

export type ItemStatus = Database['public']['Enums']['reservation_item_status']

interface BookRef {
  title: string
  author: string | null
  cover_path: string | null
}

export interface MyLoan {
  id: string
  date_given: string
  due_date: string
  date_returned: string | null
  book: BookRef | null
}

export interface MyReservationItem {
  id: string
  status: ItemStatus
  book_id: string
  book: BookRef | null
}

export interface MyReservation {
  id: string
  created_at: string
  pickup_time: string | null
  comments: string | null
  admin_note: string | null
  finalized_at: string | null
  items: MyReservationItem[]
}

/** The members.id row for the logged-in auth user (or null). */
async function currentMemberId(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return null
  const { data } = await supabase
    .from('members')
    .select('id')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle()
  return data?.id ?? null
}

/** The caller's OWN loans — scoped explicitly so admins don't see everyone's. */
export function useMyLoans() {
  return useQuery({
    queryKey: ['myLoans'],
    queryFn: async (): Promise<MyLoan[]> => {
      const mid = await currentMemberId()
      if (!mid) return []
      const { data, error } = await supabase
        .from('loans')
        .select('id, date_given, due_date, date_returned, books(title, author, cover_path)')
        .eq('member_id', mid)
        .order('due_date', { ascending: true })
      if (error) throw error
      return (data ?? []).map((l) => ({
        id: l.id,
        date_given: l.date_given,
        due_date: l.due_date,
        date_returned: l.date_returned,
        book: (l.books as BookRef | null) ?? null,
      }))
    },
  })
}

export function useMyReservations() {
  return useQuery({
    queryKey: ['myReservations'],
    queryFn: async (): Promise<MyReservation[]> => {
      const mid = await currentMemberId()
      if (!mid) return []
      const { data, error } = await supabase
        .from('reservations')
        .select(
          'id, created_at, pickup_time, comments, admin_note, finalized_at, reservation_items(id, status, book_id, books(title, author, cover_path))',
        )
        .eq('member_id', mid)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id,
        created_at: r.created_at,
        pickup_time: r.pickup_time,
        comments: r.comments,
        admin_note: r.admin_note,
        finalized_at: r.finalized_at,
        items: (r.reservation_items ?? []).map((it) => ({
          id: it.id,
          status: it.status,
          book_id: it.book_id,
          book: (it.books as BookRef | null) ?? null,
        })),
      }))
    },
  })
}
