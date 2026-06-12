import { supabase } from './supabase'

/** Invoke a Supabase Edge Function and return its JSON body (typed by caller). */
export async function callFunction<T = unknown>(
  name: string,
  body?: unknown,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    body: body ?? {},
  })
  if (error) {
    // Surface the function's JSON error message when present.
    const ctxMsg = await tryReadError(error)
    throw new Error(ctxMsg || error.message)
  }
  return data as T
}

async function tryReadError(error: unknown): Promise<string | null> {
  // FunctionsHttpError carries the original Response on `context`.
  const ctx = (error as { context?: Response })?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json()
      return body?.error || body?.reason || null
    } catch {
      return null
    }
  }
  return null
}
