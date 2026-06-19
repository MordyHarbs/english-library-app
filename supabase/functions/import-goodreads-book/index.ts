// import-goodreads-book — reads a Goodreads book page and returns editable book metadata.
import { preflight, json } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/db.ts'

const MAX_COVER_BYTES = 5 * 1024 * 1024

interface ImportedBook {
  title: string
  author: string | null
  description: string | null
  pages: number | null
  category: string | null
  cover: {
    filename: string
    content_type: string
    data_base64: string
  } | null
}

const denoRuntime = (globalThis as unknown as {
  Deno: { serve(handler: (req: Request) => Response | Promise<Response>): void }
}).Deno

denoRuntime.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf

  try {
    try {
      await requireAdmin(req)
    } catch (resp) {
      return resp instanceof Response ? resp : json({ error: 'Forbidden' }, 403)
    }

    const { url } = await req.json().catch(() => ({ url: '' }))
    const goodreadsUrl = normalizeGoodreadsUrl(String(url ?? ''))
    if (!goodreadsUrl) return json({ error: 'Paste a valid Goodreads book link.' }, 400)

    const html = await fetchHtml(goodreadsUrl)
    const imported = await parseGoodreads(html, goodreadsUrl)
    if (!imported.title) return json({ error: 'Could not find book details on that Goodreads page.' }, 422)

    return json(imported)
  } catch (e) {
    console.error('import-goodreads-book:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

function normalizeGoodreadsUrl(value: string) {
  try {
    const url = new URL(value.trim())
    if (!/(^|\.)goodreads\.com$/i.test(url.hostname)) return null
    if (!url.pathname.includes('/book/show/')) return null
    url.protocol = 'https:'
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

async function fetchHtml(url: string) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 AyalotLibraryBot/1.0',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!resp.ok) throw new Error(`Goodreads returned ${resp.status}`)
  return resp.text()
}

async function parseGoodreads(html: string, pageUrl: string): Promise<ImportedBook> {
  const jsonLd = findBookJsonLd(html)
  const imageUrl = absoluteUrl(
    stringFromJson(jsonLd?.image) ?? meta(html, 'property', 'og:image') ?? meta(html, 'name', 'twitter:image'),
    pageUrl,
  )

  const title = cleanText(
    stringFromJson(jsonLd?.name) ??
      meta(html, 'property', 'og:title')?.replace(/\s*\|\s*Goodreads\s*$/i, '') ??
      textBetween(html, /<h1[^>]*>/i, /<\/h1>/i) ??
      '',
  )
  const author = cleanText(
    authorFromJson(jsonLd?.author) ??
      textBetween(html, /<span[^>]*class="[^"]*ContributorLink__name[^"]*"[^>]*>/i, /<\/span>/i) ??
      matchFirst(html, /by\s*<[^>]+>([^<]+)<\/a>/i),
  ) || null
  const description = bestDescription([
    ...embeddedDescriptionCandidates(html),
    ...formattedSpanCandidates(html),
    stringFromJson(jsonLd?.description),
    meta(html, 'property', 'og:description'),
  ])
  const pages = numberFromJson(jsonLd?.numberOfPages) ?? parsePages(html)
  const category = cleanText(
    stringFromJson(jsonLd?.genre) ??
      matchFirst(html, /href="\/genres\/[^"#?]+"[^>]*>([^<]+)<\/a>/i),
  ) || null

  return {
    title,
    author,
    description,
    pages,
    category,
    cover: imageUrl ? await downloadCover(imageUrl, title || 'goodreads-cover') : null,
  }
}

function findBookJsonLd(html: string): Record<string, unknown> | null {
  const scripts = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1].trim())
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (isBookJson(item)) return item as Record<string, unknown>
      }
    } catch {
      // Ignore malformed third-party script data.
    }
  }
  return null
}

function isBookJson(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const type = (value as { '@type'?: unknown })['@type']
  return Array.isArray(type) ? type.includes('Book') : type === 'Book'
}

async function downloadCover(url: string, title: string): Promise<ImportedBook['cover']> {
  const resp = await fetch(url, { headers: { Accept: 'image/*' } })
  if (!resp.ok) return null
  const blob = await resp.blob()
  if (!blob.type.startsWith('image/') || blob.size > MAX_COVER_BYTES) return null
  return {
    filename: `${slug(title) || 'goodreads-cover'}.${extension(blob.type)}`,
    content_type: blob.type,
    data_base64: arrayBufferToBase64(await blob.arrayBuffer()),
  }
}

function meta(html: string, attr: 'property' | 'name', value: string) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${escapeRegex(value)}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')
  return decodeEntities(matchFirst(html, re))
}

function textBetween(html: string, start: RegExp, end: RegExp) {
  const startMatch = start.exec(html)
  if (!startMatch) return ''
  const rest = html.slice(startMatch.index + startMatch[0].length)
  const endMatch = end.exec(rest)
  if (!endMatch) return ''
  return stripTags(rest.slice(0, endMatch.index))
}

function formattedSpanCandidates(html: string) {
  const matches = html.matchAll(/<span[^>]*class="[^"]*Formatted[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)
  return Array.from(matches, (match) => stripTags(match[1]))
}

function embeddedDescriptionCandidates(html: string) {
  const candidates: string[] = []
  const patterns = [
    /"description"\s*:\s*"((?:\\.|[^"\\]){80,})"/gi,
    /"descriptionHtml"\s*:\s*"((?:\\.|[^"\\]){80,})"/gi,
    /"bookDescription"\s*:\s*"((?:\\.|[^"\\]){80,})"/gi,
  ]
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const decoded = decodeJsonString(match[1])
      if (decoded) candidates.push(decoded)
    }
  }
  return candidates
}

function bestDescription(values: Array<string | null | undefined>) {
  const cleaned = values
    .map((value) => cleanText(value))
    .filter((value) => value.length > 0)
  if (!cleaned.length) return null
  const full = cleaned.filter((value) => !isTruncated(value))
  const pool = full.length ? full : cleaned
  return pool.sort((a, b) => b.length - a.length)[0]
}

function isTruncated(value: string) {
  return /(?:\.\.\.|…)\s*$/.test(value) || /…\s*more\s*$/i.test(value)
}

function matchFirst(html: string, re: RegExp) {
  return decodeEntities(re.exec(html)?.[1] ?? '')
}

function stringFromJson(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return stringFromJson(value[0])
  return null
}

function authorFromJson(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return authorFromJson(value[0])
  if (value && typeof value === 'object') return stringFromJson((value as { name?: unknown }).name)
  return null
}

function numberFromJson(value: unknown): number | null {
  const number = Number(String(value ?? '').replace(/[^0-9]/g, ''))
  return Number.isFinite(number) && number > 0 ? number : null
}

function parsePages(html: string) {
  const pages = Number((/([0-9][0-9,]*)\s+pages/i.exec(stripTags(html))?.[1] ?? '').replace(/,/g, ''))
  return Number.isFinite(pages) && pages > 0 ? pages : null
}

function absoluteUrl(value: string | null, base: string) {
  if (!value) return null
  try {
    return new URL(value, base).toString()
  } catch {
    return null
  }
}

function stripTags(value: string) {
  return value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
}

function cleanText(value: string | null | undefined) {
  return decodeEntities(stripTags(value ?? '')).replace(/\s+/g, ' ').trim()
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function decodeJsonString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string
  } catch {
    return value.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/')
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

function extension(contentType: string) {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  return 'jpg'
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}