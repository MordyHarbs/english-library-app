import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Database } from './database.types'

export type Category = Database['public']['Tables']['categories']['Row']

export interface CatalogBook {
  id: string
  title: string
  author: string | null
  description: string | null
  pages: number | null
  serial_number: number
  cover_path: string | null
  category_id: string | null
  categoryName: string | null
  comments: string | null
  date_added: string
}

export interface Availability {
  is_available: boolean
  expected_return: string | null
}

export interface PublicSettings {
  default_book_limit: number
  max_book_limit: number
  loan_duration_days: number
  library_name: string
  library_logo_url: string
  library_icon_url: string
  contact_phone: string
}

export interface ActiveAppNotice {
  id: string
  title: string
  body: string
  sort_order: number
  dismissal_version: number
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  default_book_limit: 5,
  max_book_limit: 10,
  loan_duration_days: 14,
  library_name: 'Ayalot Library',
  library_logo_url: '/logo.png',
  library_icon_url: '/favicon.png',
  contact_phone: '053-520-9283',
}

function settingNumber(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function settingString(value: unknown, fallback: string, allowEmpty = false) {
  const text = String(value ?? fallback).trim()
  if (allowEmpty && value !== undefined && value !== null) return text
  return text || fallback
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useBooks() {
  return useQuery({
    queryKey: ['books'],
    queryFn: async (): Promise<CatalogBook[]> => {
      const { data, error } = await supabase
        .from('books')
        .select(
          'id, title, author, description, pages, serial_number, cover_path, category_id, comments, date_added, categories(name)',
        )
        .order('title', { ascending: true })
      if (error) throw error
      return (data ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        description: b.description,
        pages: b.pages,
        serial_number: b.serial_number,
        cover_path: b.cover_path,
        category_id: b.category_id,
        categoryName: (b.categories as { name: string } | null)?.name ?? null,
        comments: b.comments,
        date_added: b.date_added,
      }))
    },
  })
}

export function useBook(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['book', id],
    queryFn: async (): Promise<CatalogBook | null> => {
      const { data, error } = await supabase
        .from('books')
        .select(
          'id, title, author, description, pages, serial_number, cover_path, category_id, comments, date_added, categories(name)',
        )
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        id: data.id,
        title: data.title,
        author: data.author,
        description: data.description,
        pages: data.pages,
        serial_number: data.serial_number,
        cover_path: data.cover_path,
        category_id: data.category_id,
        categoryName: (data.categories as { name: string } | null)?.name ?? null,
        comments: data.comments,
        date_added: data.date_added,
      }
    },
  })
}

/** Map of book_id -> availability. Short stale time so checkouts show quickly. */
export function useAvailability() {
  return useQuery({
    queryKey: ['availability'],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, Availability>> => {
      const { data, error } = await supabase
        .from('book_availability')
        .select('book_id, is_available, expected_return')
      if (error) throw error
      const map: Record<string, Availability> = {}
      for (const row of data ?? []) {
        if (row.book_id) {
          map[row.book_id] = {
            is_available: row.is_available ?? true,
            expected_return: row.expected_return,
          }
        }
      }
      return map
    },
  })
}

export function usePublicSettings() {
  return useQuery({
    queryKey: ['publicSettings'],
    queryFn: async (): Promise<PublicSettings> => {
      const { data, error } = await supabase
        .from('public_settings')
        .select('key, value')
      if (error) throw error
      const out = { ...DEFAULT_PUBLIC_SETTINGS }
      for (const row of data ?? []) {
        if (row.key === 'default_book_limit') {
          out.default_book_limit = settingNumber(row.value, DEFAULT_PUBLIC_SETTINGS.default_book_limit)
        } else if (row.key === 'max_book_limit') {
          out.max_book_limit = settingNumber(row.value, DEFAULT_PUBLIC_SETTINGS.max_book_limit)
        } else if (row.key === 'loan_duration_days') {
          out.loan_duration_days = settingNumber(row.value, DEFAULT_PUBLIC_SETTINGS.loan_duration_days)
        } else if (row.key === 'library_name') {
          out.library_name = settingString(row.value, DEFAULT_PUBLIC_SETTINGS.library_name)
        } else if (row.key === 'library_logo_url') {
          out.library_logo_url = settingString(row.value, DEFAULT_PUBLIC_SETTINGS.library_logo_url)
        } else if (row.key === 'library_icon_url') {
          out.library_icon_url = settingString(row.value, DEFAULT_PUBLIC_SETTINGS.library_icon_url)
        } else if (row.key === 'contact_phone') {
          out.contact_phone = settingString(row.value, DEFAULT_PUBLIC_SETTINGS.contact_phone, true)
        }
      }
      return out
    },
  })
}

export function useActiveAppNotices() {
  return useQuery({
    queryKey: ['activeAppNotices'],
    queryFn: async (): Promise<ActiveAppNotice[]> => {
      type ActiveAppNoticeRow = {
        id: string | null
        title: string | null
        body: string | null
        sort_order: number | null
        dismissal_version?: number | null
      }
      const withVersion = await supabase
        .from('active_app_notices')
        .select('id, title, body, sort_order, dismissal_version')
        .order('sort_order', { ascending: true })
      let data: ActiveAppNoticeRow[] | null = withVersion.data
      let error = withVersion.error
      let hasDismissalVersion = true

      if (error && /schema cache|dismissal_version/i.test(error.message)) {
        const withoutVersion = await supabase
          .from('active_app_notices')
          .select('id, title, body, sort_order')
          .order('sort_order', { ascending: true })
        data = withoutVersion.data
        error = withoutVersion.error
        hasDismissalVersion = false
      }

      if (error) {
        if (/schema cache|active_app_notices|app_notices/i.test(error.message)) return []
        throw error
      }
      return (data ?? [])
        .filter((notice) => notice.id)
        .map((notice) => ({
          id: notice.id!,
          title: notice.title ?? '',
          body: notice.body ?? '',
          sort_order: notice.sort_order ?? 999,
          dismissal_version: hasDismissalVersion && 'dismissal_version' in notice
            ? notice.dismissal_version ?? 1
            : 1,
        }))
    },
  })
}
