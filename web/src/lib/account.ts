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

/** All of the caller's loans (RLS limits to their own). */
export function useMyLoans() {
  return useQuery({
    queryKey: ['myLoans'],
    queryFn: async (): Promise<MyLoan[]> => {
      const { data, error } = await supabase
        .from('loans')
        .select('id, date_given, due_date, date_returned, books(title, author, cover_path)')
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
      const { data, error } = await supabase
        .from('reservations')
        .select(
          'id, created_at, pickup_time, comments, admin_note, finalized_at, reservation_items(id, status, book_id, books(title, author, cover_path))',
        )
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
