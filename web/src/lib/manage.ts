import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Database } from './database.types'

export type Member = Database['public']['Tables']['members']['Row']

export interface AdminLoan {
  id: string
  date_given: string
  due_date: string
  date_returned: string | null
  book_id: string
  member_id: string
  bookTitle: string
  bookAuthor: string | null
  memberName: string
}

function mapLoan(l: Record<string, unknown>): AdminLoan {
  const book = l.books as { title: string; author: string | null } | null
  const member = l.members as { name: string } | null
  return {
    id: l.id as string,
    date_given: l.date_given as string,
    due_date: l.due_date as string,
    date_returned: (l.date_returned as string) ?? null,
    book_id: l.book_id as string,
    member_id: l.member_id as string,
    bookTitle: book?.title ?? 'Unknown',
    bookAuthor: book?.author ?? null,
    memberName: member?.name ?? 'Unknown',
  }
}

const LOAN_SELECT =
  'id, date_given, due_date, date_returned, book_id, member_id, books(title, author), members(name)'

export function useOpenLoans() {
  return useQuery({
    queryKey: ['admin', 'loans', 'open'],
    queryFn: async (): Promise<AdminLoan[]> => {
      const { data, error } = await supabase
        .from('loans')
        .select(LOAN_SELECT)
        .is('date_returned', null)
        .order('due_date', { ascending: true })
      if (error) throw error
      return (data ?? []).map(mapLoan)
    },
  })
}

export function useLoanHistory() {
  return useQuery({
    queryKey: ['admin', 'loans', 'history'],
    queryFn: async (): Promise<AdminLoan[]> => {
      const { data, error } = await supabase
        .from('loans')
        .select(LOAN_SELECT)
        .not('date_returned', 'is', null)
        .order('date_returned', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []).map(mapLoan)
    },
  })
}

export function useMembers() {
  return useQuery({
    queryKey: ['admin', 'members'],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export interface WorkbenchData {
  holds: { reservation_item_id: string; book_id: string; title: string }[]
  loans: AdminLoan[]
}

/** A member's approved holds (ready to lend) + their current open loans. */
export function useMemberWorkbench(memberId: string | undefined) {
  return useQuery({
    enabled: !!memberId,
    queryKey: ['admin', 'workbench', memberId],
    queryFn: async (): Promise<WorkbenchData> => {
      const [{ data: holds }, { data: loans }] = await Promise.all([
        supabase
          .from('reservation_items')
          .select('id, book_id, books(title), reservations!inner(member_id)')
          .eq('status', 'approved')
          .eq('reservations.member_id', memberId!),
        supabase
          .from('loans')
          .select(LOAN_SELECT)
          .eq('member_id', memberId!)
          .is('date_returned', null),
      ])
      return {
        holds: (holds ?? []).map((h) => ({
          reservation_item_id: h.id,
          book_id: h.book_id,
          title: (h.books as { title: string } | null)?.title ?? 'Unknown',
        })),
        loans: (loans ?? []).map(mapLoan),
      }
    },
  })
}

export type Setting = Database['public']['Tables']['settings']['Row']
export type AppNotice = Database['public']['Tables']['app_notices']['Row']

export function useSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async (): Promise<Setting[]> => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .not('key', 'like', 'legacy_%')
        .order('key', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useAppNotices() {
  return useQuery({
    queryKey: ['admin', 'appNotices'],
    queryFn: async (): Promise<AppNotice[]> => {
      const { data, error } = await supabase
        .from('app_notices')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map((notice) => ({
        ...notice,
        dismissal_version: notice.dismissal_version ?? 1,
      }))
    },
  })
}
