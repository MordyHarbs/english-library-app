// daily-reminders (TECH-PLAN D3) — run by pg_cron once a day (and callable
// manually for testing). Sends "due soon" and "overdue" emails, grouped per
// member, deduped so the same loan never triggers the same email twice in a day.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/db.ts'
import { sendEmail } from '../_shared/email.ts'
import { addDays, jerusalemToday, fmt } from '../_shared/dates.ts'
import { markDailyTaskRan, shouldRunDailyTask } from '../_shared/schedule.ts'
import { loadBranding } from '../_shared/branding.ts'

const denoRuntime = (globalThis as unknown as {
  Deno: { serve(handler: (req: Request) => Response | Promise<Response>): void }
}).Deno

interface LoanRow {
  id: string
  due_date: string
  member_id: string
  books: unknown
  members: unknown
}

denoRuntime.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf
  try {
    const db = serviceClient()
    const options = await loadRequestOptions(req)
    const schedule = await shouldRunDailyTask(req, db, 'daily_reminders_last_run_date')
    if (!schedule.shouldRun) return json({ sent: 0, skipped: 0, ...schedule })

    const settings = await loadSettings(db)
    const today = options.test_today ?? jerusalemToday()
    const todayStr = fmt(today)

    let sent = 0
    let skipped = 0
    const would_send: ReminderPreview[] = []

    // --- Due soon ---
    if (settings.email_due_soon) {
      const target = fmt(addDays(today, settings.reminder_days_before))
      const { data } = await db
        .from('loans')
        .select('id, due_date, member_id, books(title, cover_path), members(name, email)')
        .is('date_returned', null)
        .eq('due_date', target)
      const r = await dispatch(db, (data ?? []) as LoanRow[], 'due_soon', todayStr, settings, options)
      sent += r.sent
      skipped += r.skipped
      would_send.push(...r.would_send)
    }

    // --- Overdue ---
    if (settings.email_overdue || options.force_overdue) {
      const { data } = await db
        .from('loans')
        .select('id, due_date, member_id, books(title, cover_path), members(name, email)')
        .is('date_returned', null)
        .lt('due_date', todayStr)
      const r = await dispatch(db, (data ?? []) as LoanRow[], 'overdue', todayStr, settings, options)
      sent += r.sent
      skipped += r.skipped
      would_send.push(...r.would_send)
    }

    if (schedule.source === 'cron' && !options.dry_run && !options.test_recipient) {
      await markDailyTaskRan(db, 'daily_reminders_last_run_date', todayStr)
    }

    return json({
      sent,
      skipped,
      dry_run: options.dry_run,
      test_recipient: options.test_recipient,
      test_today: options.test_today ? todayStr : null,
      force_overdue: options.force_overdue,
      would_send,
      source: schedule.source,
      scheduled_time: schedule.scheduled_time,
    })
  } catch (e) {
    console.error('daily-reminders:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

interface Settings {
  reminder_days_before: number
  email_due_soon: boolean
  email_overdue: boolean
  late_fee_per_week: number
  admin_notification_email: string
  library_name: string
  contact_phone: string
}

interface ReminderOptions {
  dry_run: boolean
  test_recipient: string | null
  test_today: Date | null
  force_overdue: boolean
}

interface ReminderPreview {
  type: 'due_soon' | 'overdue'
  intended_recipient: string
  member: string
  subject: string
  due_date: string
  loan_ids: string[]
  books: string[]
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const cleanText = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()

async function loadSettings(db: ReturnType<typeof serviceClient>): Promise<Settings> {
  const { data } = await db.from('settings').select('key, value')
  const m: Record<string, unknown> = {}
  for (const s of data ?? []) m[s.key] = s.value
  const branding = await loadBranding(db)
  return {
    reminder_days_before: Number(m.reminder_days_before ?? 2),
    email_due_soon: m.email_due_soon !== false,
    email_overdue: m.email_overdue !== false,
    late_fee_per_week: Number(m.late_fee_per_week ?? 0),
    admin_notification_email: branding.adminNotificationEmail,
    library_name: branding.libraryName,
    contact_phone: branding.contactPhone,
  }
}

async function loadRequestOptions(req: Request): Promise<ReminderOptions> {
  try {
    const body = await req.clone().json()
    const testRecipient = typeof body?.test_recipient === 'string' ? body.test_recipient.trim() : ''
    const test_recipient = testRecipient && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testRecipient) ? testRecipient : null
    const dry_run = body?.dry_run === true
    return {
      dry_run,
      test_recipient,
      test_today: dry_run || test_recipient ? parseTestDate(body?.test_today) : null,
      force_overdue: (dry_run || test_recipient) && body?.force_overdue === true,
    }
  } catch {
    return { dry_run: false, test_recipient: null, test_today: null, force_overdue: false }
  }
}

function parseTestDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return fmt(date) === value ? date : null
}

async function dispatch(
  db: ReturnType<typeof serviceClient>,
  loans: LoanRow[],
  type: 'due_soon' | 'overdue',
  todayStr: string,
  settings: Settings,
  options: ReminderOptions,
): Promise<{ sent: number; skipped: number; would_send: ReminderPreview[] }> {
  let sent = 0
  let skipped = 0
  const would_send: ReminderPreview[] = []

  // Filter out loans already notified today (dedupe) only for real member sends.
  // Test and preview calls should still be usable after the daily job ran.
  const fresh: LoanRow[] = []
  for (const l of loans) {
    if (options.dry_run || options.test_recipient) {
      fresh.push(l)
      continue
    }
    const key = `${type}:${l.id}:${todayStr}`
    const { data: exists } = await db
      .from('email_log')
      .select('id')
      .eq('dedupe_key', key)
      .maybeSingle()
    if (exists) skipped++
    else fresh.push(l)
  }

  // Group by member.
  const byMember = new Map<string, LoanRow[]>()
  for (const l of fresh) byMember.set(l.member_id, [...(byMember.get(l.member_id) ?? []), l])

  for (const [, memberLoans] of byMember) {
    const member = memberLoans[0].members as { name: string; email: string } | null
    if (!member?.email) continue

    const books = memberLoans.map((l) => ({
      title: cleanText((l.books as { title: string; cover_path: string | null } | null)?.title ?? 'book'),
      coverUrl: coverUrl(db, (l.books as { cover_path: string | null } | null)?.cover_path),
    }))
    const isMultiple = books.length > 1
    const returnDateStr = formatDisplayDate(memberLoans[0].due_date)

    const subject = type === 'due_soon'
      ? isMultiple
        ? `Library Reminder: ${books.length} books due for return on ${returnDateStr}`
        : `Library Reminder: Return due for "${books[0].title}"`
      : isMultiple
        ? `Library Reminder: ${books.length} overdue books were due on ${returnDateStr}`
        : `Library Reminder: "${books[0].title}" is overdue`

    const textIntro = type === 'due_soon'
      ? `This is a friendly reminder that the following book${isMultiple ? 's' : ''} you borrowed ${isMultiple ? 'are' : 'is'} due for return on ${returnDateStr}:`
      : `This is a friendly reminder that the following book${isMultiple ? 's' : ''} you borrowed ${isMultiple ? 'were' : 'was'} due for return on ${returnDateStr}:`
    const extensionText = extensionRequestText(settings)
    const textBody = `Hello ${member.name},\n\n${textIntro}\n\n${books.map((b) => `- "${b.title}"`).join('\n')}\n\n${extensionText}\n\nThank you,\nThe Library Team\n\n---\nThis is an automated message sent by the ${settings.library_name} system.`

    let html = `<p>Hello ${esc(member.name)},</p><p>${textIntro.replace(returnDateStr, `<b>${esc(returnDateStr)}</b>`)}</p>`
    html += `<div style="text-align: center; margin: 20px 0;">`
    for (const book of books) {
      html += `<div style="margin: 16px 8px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; display: inline-block; width: 200px; height: 320px; vertical-align: top; text-align: center; overflow: hidden; background-color: #fafafa;">`
      html += `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">`
      html += `<tr><td height="52" align="center" valign="middle" style="height: 52px; vertical-align: middle; text-align: center; font-weight: bold; font-size: 14px; line-height: 1.3; color: #222;">${esc(book.title)}</td></tr>`
      html += `</table>`
      if (book.coverUrl) {
        html += `<img src="${book.coverUrl}" alt="${esc(book.title)}" style="max-height: 230px; max-width: 180px; width: auto; height: auto; border-radius: 4px; object-fit: contain;" />`
      }
      html += `</div>`
    }
    html += `</div>`
    html += `<p style="margin-top: 20px;">${extensionRequestHtml(settings)}</p>`
    if (type === 'overdue' && settings.late_fee_per_week > 0)
      html += `<p>A late fee of ₪${settings.late_fee_per_week} per week may apply.</p>`
    html += `<p>Thank you,<br>The Library Team</p>`
    html += `<hr style="border: none; border-top: 1px solid #ccc; margin-top: 24px;"><p style="font-size: 12px; color: #888;">This is an automated message sent by the ${esc(settings.library_name)} system.</p>`

    const preview = {
      type,
      intended_recipient: member.email,
      member: member.name,
      subject,
      due_date: memberLoans[0].due_date,
      loan_ids: memberLoans.map((l) => l.id),
      books: books.map((b) => b.title),
    }
    would_send.push(preview)

    if (options.dry_run) continue

    const ok = await sendEmail({
      to: options.test_recipient ?? member.email,
      bcc: options.test_recipient ? undefined : settings.admin_notification_email,
      fromName: settings.library_name,
      subject: options.test_recipient ? `[TEST] ${subject}` : subject,
      text: options.test_recipient
        ? `TEST ONLY. Intended recipient: ${member.name} <${member.email}>\n\n${textBody}`
        : textBody,
      html: options.test_recipient
        ? `<p><b>TEST ONLY.</b> Intended recipient: ${esc(member.name)} &lt;${esc(member.email)}&gt;</p>${html}`
        : html,
    })
    if (ok) {
      if (!options.test_recipient) {
        for (const l of memberLoans) {
          await db.from('email_log').insert({
            type,
            recipient: member.email,
            loan_id: l.id,
            dedupe_key: `${type}:${l.id}:${todayStr}`,
          })
        }
      }
      sent++
    }
  }

  return { sent, skipped, would_send }
}

function extensionRequestText(settings: Settings) {
  const contact = settings.contact_phone
    ? ` or contact us at ${settings.contact_phone}`
    : ''
  return `If you need more time, please reply to this email${contact} to request an extension before the due date — this way we can avoid any late fees (5 NIS per week, we start charging after the first week).`
}

function extensionRequestHtml(settings: Settings) {
  const contact = settings.contact_phone
    ? ` or contact us at <b>${esc(settings.contact_phone)}</b>`
    : ''
  return `If you need more time, please <b>reply to this email</b>${contact} to request an extension before the due date — this way we can avoid any late fees (5 NIS per week, we start charging after the first week).`
}

function coverUrl(db: ReturnType<typeof serviceClient>, path: string | null | undefined) {
  if (!path) return ''
  return db.storage.from('covers').getPublicUrl(path).data.publicUrl
}

function formatDisplayDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}
