import { supabase } from './supabase'

/** Public URL for a book cover stored in the `covers` bucket, or null. */
export function coverUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from('covers').getPublicUrl(path).data.publicUrl
}
