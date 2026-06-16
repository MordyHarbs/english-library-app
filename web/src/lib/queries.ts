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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_settings')
        .select('key, value')
      if (error) throw error
      const out: Record<string, number> = {
        default_book_limit: 5,
        max_book_limit: 10,
        loan_duration_days: 14,
      }
      for (const row of data ?? []) {
        if (row.key) out[row.key] = Number(row.value)
      }
      return out
    },
  })
}
