/**
 * One-time Google Sheet -> Supabase importer (TECH-PLAN D5, BUILD-PLAN Phase 4).
 *
 * Reads the JSON + covers exported by `exportAllData()` (old Apps Script project)
 * from EXPORT_DIR, cleans the data, uploads covers, and inserts everything.
 *
 * Usage:
 *   cp .env.example .env   # fill in SUPABASE_URL + SERVICE_ROLE_KEY
 *   npm run import -- --wipe
 *
 * Idempotent with --wipe: clears app tables (never auth, never settings defaults)
 * and re-imports. Unmatched / invalid rows are written to migration-report.txt.
 */
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

process.loadEnvFile(join(import.meta.dirname, '.env'))

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY!
const EXPORT_DIR = join(import.meta.dirname, process.env.EXPORT_DIR || './export')
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)
const WIPE = process.argv.includes('--wipe')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SERVICE_ROLE_KEY in migration/.env')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Drive appends an extension on download (cover-1 -> cover-1.png), so map each
// cover's base name to its actual filename.
const coverByBase = new Map<string, string>()
const coversDir = join(EXPORT_DIR, 'covers')
if (existsSync(coversDir)) {
  for (const f of readdirSync(coversDir)) {
    coverByBase.set(f.replace(/\.[^.]+$/, ''), f)
  }
}
const resolveCover = (base: string): string => (base ? coverByBase.get(base) ?? '' : '')

const report: string[] = []
const note = (line: string) => {
  report.push(line)
  console.warn('  ⚠ ' + line)
}

// --- helpers ---------------------------------------------------------------
const readJson = <T>(name: string): T[] => {
  const path = join(EXPORT_DIR, name)
  if (!existsSync(path)) {
    note(`Missing export file: ${name} (treating as empty)`)
    return []
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

const norm = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
const clean = (s: unknown) => String(s ?? '').trim()
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

const toDate = (v: unknown): string | null => {
  if (!v) return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
const toTimestamp = (v: unknown): string | null => {
  if (!v) return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? null : d.toISOString()
}
const toInt = (v: unknown): number | null => {
  const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10)
  return isNaN(n) ? null : n
}
const TRUTHY = new Set(['yes', 'true', '✓', 'v', 'paid', '1', 'כן'])
const toPaid = (v: unknown, ctx: string): boolean => {
  if (v === true) return true
  if (v === false || v == null || v === '') return false
  const s = norm(v)
  if (TRUTHY.has(s)) return true
  note(`Unrecognized "Paid" value "${clean(v)}" for ${ctx} → set false`)
  return false
}

// --- wipe ------------------------------------------------------------------
async function wipe() {
  console.log('Wiping app tables (auth + settings preserved)…')
  const order = ['reservation_items', 'loans', 'reservations', 'books', 'members', 'categories', 'email_log']
  for (const table of order) {
    const { error } = await db.from(table).delete().not('id', 'is', null)
    if (error) throw new Error(`wipe ${table}: ${error.message}`)
  }
}

// --- main ------------------------------------------------------------------
async function main() {
  console.log(`Importing from ${EXPORT_DIR}`)
  if (WIPE) await wipe()

  const manifest = existsSync(join(EXPORT_DIR, 'manifest.json'))
    ? JSON.parse(readFileSync(join(EXPORT_DIR, 'manifest.json'), 'utf8'))
    : { counts: {} }

  // ---- Categories ---------------------------------------------------------
  const catRows = readJson<Record<string, unknown>>('categories.json')
  const catNames: string[] = []
  for (const r of catRows) {
    // Category sheet is a single column; take the first non-empty value.
    const name = clean(Object.values(r)[0])
    if (name && !catNames.some((c) => norm(c) === norm(name))) catNames.push(name)
  }
  const catIdByNorm = new Map<string, string>()
  if (catNames.length) {
    const payload = catNames.map((name, i) => ({ name, sort_order: i + 1 }))
    const { data, error } = await db.from('categories').insert(payload).select('id, name')
    if (error) throw new Error(`categories: ${error.message}`)
    data!.forEach((c) => catIdByNorm.set(norm(c.name), c.id))
  }
  const ensureCategory = async (name: string): Promise<string | null> => {
    const n = norm(name)
    if (!n) return null
    if (catIdByNorm.has(n)) return catIdByNorm.get(n)!
    const { data, error } = await db
      .from('categories')
      .insert({ name: clean(name), sort_order: 999 })
      .select('id')
      .single()
    if (error) throw new Error(`category "${name}": ${error.message}`)
    catIdByNorm.set(n, data!.id)
    return data!.id
  }
  console.log(`Categories: ${catIdByNorm.size}`)

  // ---- Books (+ covers) ---------------------------------------------------
  const bookRows = readJson<Record<string, unknown>>('books.json')
  const bookIdByNorm = new Map<string, string>()
  let coverCount = 0
  for (const r of bookRows) {
    const title = clean(r['Title'])
    if (!title) continue
    const category_id = await ensureCategory(clean(r['Category']))
    const { data, error } = await db
      .from('books')
      .insert({
        title,
        author: clean(r['Auther']) || null,
        category_id,
        description: clean(r['Descrtiption']) || null,
        pages: toInt(r['Amount of pages']),
        comments: clean(r['Comments']) || null,
        date_added: toTimestamp(r['Date added']),
      })
      .select('id')
      .single()
    if (error) throw new Error(`book "${title}": ${error.message}`)
    const bookId = data!.id
    bookIdByNorm.set(norm(title), bookId)

    const coverFile = resolveCover(clean(r['coverFile']))
    if (coverFile) {
      try {
        const buf = readFileSync(join(EXPORT_DIR, 'covers', coverFile))
        const jpg = await sharp(buf).rotate().resize({ width: 600, withoutEnlargement: true })
          .jpeg({ quality: 80 }).toBuffer()
        const path = `${bookId}.jpg`
        const { error: upErr } = await db.storage.from('covers').upload(path, jpg, {
          contentType: 'image/jpeg',
          upsert: true,
        })
        if (upErr) throw upErr
        await db.from('books').update({ cover_path: path }).eq('id', bookId)
        coverCount++
      } catch (e) {
        note(`Cover failed for "${title}": ${(e as Error).message}`)
      }
    } else if (clean(r['photoUrl'])) {
      note(`Book "${title}" had a photo URL but no exported cover file`)
    }
  }
  console.log(`Books: ${bookIdByNorm.size} (covers: ${coverCount})`)

  // ---- Members ------------------------------------------------------------
  const memberRows = readJson<Record<string, unknown>>('members.json')
  const memberIdByNorm = new Map<string, string>()
  let memberCount = 0
  for (const r of memberRows) {
    const name = clean(r['Name'])
    const email = clean(r['Email Adress']).toLowerCase()
    if (!name && !email) continue
    if (!isEmail(email)) {
      note(`Member "${name || '(no name)'}" has invalid/missing email "${clean(r['Email Adress'])}" → SKIPPED (cannot log in). Add manually in admin.`)
      continue
    }
    const isAdmin = ADMIN_EMAILS.includes(email)
    const { data, error } = await db
      .from('members')
      .insert({
        name: name || email,
        email,
        phone: clean(r['Phone number']) || null,
        address: clean(r['Adress']) || null,
        paid: toPaid(r['Paid'], name || email),
        comments: clean(r['Comments']) || null,
        is_admin: isAdmin,
        date_added: toTimestamp(r['Date added']),
      })
      .select('id')
      .single()
    if (error) {
      note(`Member "${name}" <${email}>: ${error.message}`)
      continue
    }
    memberIdByNorm.set(norm(name), data!.id)
    memberCount++
  }
  console.log(`Members: ${memberCount}${ADMIN_EMAILS.length ? ` (admins: ${ADMIN_EMAILS.join(', ')})` : ''}`)

  // ---- Guarantee admin accounts exist (so the librarian can always log in) --
  for (const adminEmail of ADMIN_EMAILS) {
    const { data: existing } = await db
      .from('members')
      .select('id')
      .eq('email', adminEmail)
      .maybeSingle()
    if (existing) {
      await db.from('members').update({ is_admin: true }).eq('id', existing.id)
    } else {
      const { error } = await db.from('members').insert({
        name: adminEmail.split('@')[0],
        email: adminEmail,
        paid: true,
        is_admin: true,
      })
      if (error) note(`Could not create admin "${adminEmail}": ${error.message}`)
      else console.log(`  + created admin account: ${adminEmail}`)
    }
  }

  // ---- Loans (open from Books out, closed from Lending History) -----------
  const loanDuration =
    (await db.from('settings').select('value').eq('key', 'loan_duration_days').single())
      .data?.value ?? 14

  const insertLoan = async (
    r: Record<string, unknown>,
    closed: boolean,
    source: string,
  ) => {
    const memberName = clean(r['Member Name'])
    const bookTitle = clean(r['Book Title'])
    const member_id = memberIdByNorm.get(norm(memberName))
    const book_id = bookIdByNorm.get(norm(bookTitle))
    if (!member_id) return note(`${source}: member "${memberName}" not found → row skipped`)
    if (!book_id) return note(`${source}: book "${bookTitle}" not found → row skipped`)

    const date_given = toDate(r['Date given']) ?? new Date().toISOString().slice(0, 10)
    let due_date = toDate(r['Expected return'])
    if (!due_date) {
      const d = new Date(date_given)
      d.setDate(d.getDate() + Number(loanDuration))
      due_date = d.toISOString().slice(0, 10)
    }
    const date_returned = closed ? toDate(r['Date returned']) : null

    const { error } = await db.from('loans').insert({
      book_id,
      member_id,
      date_given,
      due_date,
      date_returned,
      comments: clean(r['Comments']) || null,
    })
    if (error) note(`${source}: loan "${bookTitle}"/"${memberName}": ${error.message}`)
    else return true
  }

  let open = 0
  for (const r of readJson<Record<string, unknown>>('books_out.json')) {
    if (await insertLoan(r, false, 'Books out')) open++
  }
  let closed = 0
  for (const r of readJson<Record<string, unknown>>('lending_history.json')) {
    if (await insertLoan(r, true, 'Lending History')) closed++
  }
  console.log(`Loans: ${open} open, ${closed} returned`)

  // ---- Legacy Cofing values (preserved, defaults untouched) ---------------
  const cofing = readJson<Record<string, unknown>>('settings.json')
  for (const r of cofing) {
    const settingName = clean(r['Setting'])
    if (!settingName) continue
    const key = 'legacy_' + norm(settingName).replace(/[^a-z0-9]+/g, '_')
    await db.from('settings').upsert({
      key,
      value: { amount: r['Amount'] ?? null, type: r['Type'] ?? null },
      description: `Imported from old Cofing sheet: ${settingName}`,
    })
  }

  // ---- Verify vs manifest -------------------------------------------------
  console.log('\nChecksum vs manifest:')
  const compare = (label: string, got: number, expected: unknown) => {
    const exp = typeof expected === 'number' ? expected : '?'
    const ok = exp === '?' || got === exp ? '✓' : '✗'
    console.log(`  ${ok} ${label}: imported ${got}, sheet had ${exp}`)
  }
  compare('books', bookIdByNorm.size, manifest.counts?.books)
  compare('members', memberCount, manifest.counts?.members)
  compare('open loans', open, manifest.counts?.books_out)
  compare('history', closed, manifest.counts?.lending_history)

  // ---- Report -------------------------------------------------------------
  const reportPath = join(import.meta.dirname, 'migration-report.txt')
  writeFileSync(
    reportPath,
    report.length
      ? `Migration review — ${report.length} item(s) need attention:\n\n` + report.map((l) => '- ' + l).join('\n') + '\n'
      : 'Migration clean — no issues to review.\n',
  )
  console.log(`\n${report.length ? report.length + ' issue(s)' : 'No issues'} → ${reportPath}`)
  console.log('Done.')
}

main().catch((e) => {
  console.error('\nImport failed:', e.message)
  process.exit(1)
})
