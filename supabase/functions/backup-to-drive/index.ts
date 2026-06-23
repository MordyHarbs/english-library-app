// backup-to-drive — exports app data and cover files to Google Drive.
// Manual calls require an admin session. Cron calls may use the service-role key.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient, requireAdmin } from '../_shared/db.ts'
import { fmt, jerusalemToday } from '../_shared/dates.ts'
import { markDailyTaskRan, shouldRunDailyTask } from '../_shared/schedule.ts'
import { loadBranding } from '../_shared/branding.ts'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const PAGE_SIZE = 1000
const COVER_BUNDLE_LIMIT_BYTES = 4 * 1024 * 1024

const DATA_TABLES = [
  'members',
  'categories',
  'books',
  'reservations',
  'reservation_items',
  'loans',
  'settings',
  'email_log',
  'app_notices',
]

interface BackupResult {
  ok: true
  backup_folder_id: string
  backup_path: string
  tables: { name: string; rows: number; skipped?: boolean; error?: string }[]
  covers: { files: number; bundles?: number; skipped?: boolean; error?: string }
}

type TableExport = BackupResult['tables'][number] & { rows_data?: unknown[] }

const denoRuntime = (globalThis as unknown as {
  Deno: {
    serve(handler: (req: Request) => Response | Promise<Response>): void
    env: { get(name: string): string | undefined }
  }
}).Deno

denoRuntime.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf

  try {
    if (!isServiceRoleCall(req)) {
      try {
        await requireAdmin(req)
      } catch (resp) {
        return resp instanceof Response ? resp : json({ error: 'Forbidden' }, 403)
      }
    }

    const db = serviceClient()
    const schedule = await shouldRunDailyTask(req, db, 'daily_backup_last_run_date')
    if (!schedule.shouldRun) return json({ ok: true, skipped: true, ...schedule })
    const branding = await loadBranding(db)
    const rootFolderName = branding.backupFolderName

    const accessToken = await getDriveAccessToken()
    const now = new Date()
    const day = fmt(jerusalemToday())
    const time = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', 'Z')

    const root = await findOrCreateFolder(accessToken, rootFolderName, null)
    const yearFolder = await findOrCreateFolder(accessToken, day.slice(0, 4), root.id)
    const monthFolder = await findOrCreateFolder(accessToken, day.slice(5, 7), yearFolder.id)
    const dayFolder = await findOrCreateFolder(accessToken, day, monthFolder.id)
    const backupFolder = await createFolder(accessToken, time, dayFolder.id)
    const dataFolder = await createFolder(accessToken, 'data', backupFolder.id)
    const coversFolder = await createFolder(accessToken, 'covers', backupFolder.id)

    const tableResults: BackupResult['tables'] = []
    for (const table of DATA_TABLES) {
      const result = await exportTable(db, table)
      tableResults.push(result)
      if (!result.skipped && !result.error) {
        await uploadJson(accessToken, dataFolder.id, `${table}.json`, result.rows_data)
      }
      delete result.rows_data
    }

    const covers = await exportCovers(db, accessToken, coversFolder.id)

    const manifest = {
      generated_at: now.toISOString(),
      backup_path: `${rootFolderName}/${day.slice(0, 4)}/${day.slice(5, 7)}/${day}/${time}`,
      tables: tableResults,
      covers,
    }
    await uploadJson(accessToken, backupFolder.id, 'manifest.json', manifest)

    if (schedule.source === 'cron') {
      await markDailyTaskRan(db, 'daily_backup_last_run_date', schedule.today)
    }

    const response: BackupResult = {
      ok: true,
      backup_folder_id: backupFolder.id,
      backup_path: manifest.backup_path,
      tables: tableResults,
      covers,
    }
    return json(response)
  } catch (e) {
    console.error('backup-to-drive:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

function isServiceRoleCall(req: Request) {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  const payload = decodeJwtPayload(token)
  return payload?.role === 'service_role'
}

function decodeJwtPayload(token: string): { role?: string } | null {
  try {
    const encoded = token.split('.')[1]
    if (!encoded) return null
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as { role?: string }
  } catch {
    return null
  }
}

async function exportTable(db: ReturnType<typeof serviceClient>, table: string): Promise<TableExport> {
  const rows: unknown[] = []
  let from = 0

  while (true) {
    const { data, error } = await db.from(table).select('*').range(from, from + PAGE_SIZE - 1)
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return { name: table, rows: 0, skipped: true, error: error.message }
      }
      throw error
    }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return { name: table, rows: rows.length, rows_data: rows }
}

async function exportCovers(
  db: ReturnType<typeof serviceClient>,
  accessToken: string,
  parentId: string,
): Promise<BackupResult['covers']> {
  try {
    let files = 0
    let bundles = 0
    let bundleBytes = 0
    let bundle: CoverBackupEntry[] = []

    async function flushBundle() {
      if (!bundle.length) return
      bundles++
      await uploadJson(accessToken, parentId, `covers-${String(bundles).padStart(3, '0')}.json`, {
        format: 'ayalot-cover-backup-v1',
        encoding: 'base64',
        files: bundle,
      })
      bundle = []
      bundleBytes = 0
    }

    await walkStorageFolder(db, accessToken, parentId, '')
    await flushBundle()
    return { files, bundles }

    async function walkStorageFolder(
      dbClient: ReturnType<typeof serviceClient>,
      _token: string,
      _driveParentId: string,
      prefix: string,
    ) {
      const { data, error } = await dbClient.storage.from('covers').list(prefix, { limit: 1000 })
      if (error) {
        if (/not found|does not exist/i.test(error.message)) return
        throw error
      }

      for (const entry of data ?? []) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name
        if (!entry.id && !entry.metadata) {
          await walkStorageFolder(dbClient, accessToken, parentId, path)
          continue
        }

        const { data: blob, error: downloadError } = await dbClient.storage.from('covers').download(path)
        if (downloadError) throw downloadError
        const bytes = await blob.arrayBuffer()
        const data = arrayBufferToBase64(bytes)
        const estimatedBytes = data.length
        if (bundle.length && bundleBytes + estimatedBytes > COVER_BUNDLE_LIMIT_BYTES) {
          await flushBundle()
        }
        bundle.push({
          path,
          content_type: blob.type || 'application/octet-stream',
          size: blob.size,
          data_base64: data,
        })
        bundleBytes += estimatedBytes
        files++
      }
    }
  } catch (e) {
    return { files: 0, skipped: true, error: (e as Error).message }
  }
}

interface CoverBackupEntry {
  path: string
  content_type: string
  size: number
  data_base64: string
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

async function getDriveAccessToken() {
  const clientId = requiredEnv('GOOGLE_DRIVE_CLIENT_ID')
  const clientSecret = requiredEnv('GOOGLE_DRIVE_CLIENT_SECRET')
  const refreshToken = requiredEnv('GOOGLE_DRIVE_REFRESH_TOKEN')

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const body = await resp.json()
  if (!resp.ok) throw new Error(`Google token request failed: ${body.error_description || body.error}`)
  return String(body.access_token)
}

function requiredEnv(name: string) {
  const value = denoRuntime.env.get(name)
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

async function findOrCreateFolder(accessToken: string, name: string, parentId: string | null) {
  const query = [
    `name = '${escapeDriveQuery(name)}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    'trashed = false',
    parentId ? `'${parentId}' in parents` : null,
  ].filter(Boolean).join(' and ')
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive&pageSize=1`
  const resp = await fetch(url, { headers: authHeaders(accessToken) })
  const body = await resp.json()
  if (!resp.ok) throw new Error(`Drive folder lookup failed: ${body.error?.message || resp.statusText}`)
  const existing = body.files?.[0]
  if (existing) return existing as { id: string; name: string }
  return createFolder(accessToken, name, parentId)
}

async function createFolder(accessToken: string, name: string, parentId: string | null) {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  }
  if (parentId) metadata.parents = [parentId]

  const resp = await fetch(`${DRIVE_API}/files?fields=id,name`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  })
  const body = await resp.json()
  if (!resp.ok) throw new Error(`Drive folder create failed: ${body.error?.message || resp.statusText}`)
  return body as { id: string; name: string }
}

async function uploadJson(accessToken: string, parentId: string, name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  await uploadBinary(accessToken, parentId, name, 'application/json', blob)
}

async function uploadBinary(
  accessToken: string,
  parentId: string,
  name: string,
  mimeType: string,
  data: Blob,
) {
  const metadata = { name, parents: [parentId], mimeType }
  const boundary = `ayalot-${crypto.randomUUID()}`
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    data,
    `\r\n--${boundary}--`,
  ])
  const resp = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  const result = await resp.json()
  if (!resp.ok) throw new Error(`Drive upload failed for ${name}: ${result.error?.message || resp.statusText}`)
  return result as { id: string; name: string }
}

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
