// daily-reminders (TECH-PLAN D3) — run by pg_cron once a day (and callable
// manually for testing). Sends "due soon" and "overdue" emails, grouped per
// member, deduped so the same loan never triggers the same email twice in a day.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/db.ts'
import { sendEmail } from '../_shared/email.ts'
import { addDays, jerusalemToday, fmt } from '../_shared/dates.ts'
import { markDailyTaskRan, shouldRunDailyTask } from '../_shared/schedule.ts'

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
    const schedule = await shouldRunDailyTask(req, db, 'daily_reminders_last_run_date')
    if (!schedule.shouldRun) return json({ sent: 0, skipped: 0, ...schedule })

    const settings = await loadSettings(db)
    const today = jerusalemToday()
    const todayStr = fmt(today)

    let sent = 0
    let skipped = 0

    // --- Due soon ---
    if (settings.email_due_soon) {
      const target = fmt(addDays(today, settings.reminder_days_before))
      const { data } = await db
        .from('loans')
        .select('id, due_date, member_id, books(title, cover_path), members(name, email)')
        .is('date_returned', null)
        .eq('due_date', target)
      const r = await dispatch(db, (data ?? []) as LoanRow[], 'due_soon', todayStr, settings)
      sent += r.sent
      skipped += r.skipped
    }

    // --- Overdue ---
    if (settings.email_overdue) {
      const { data } = await db
        .from('loans')
        .select('id, due_date, member_id, books(title, cover_path), members(name, email)')
        .is('date_returned', null)
        .lt('due_date', todayStr)
      const r = await dispatch(db, (data ?? []) as LoanRow[], 'overdue', todayStr, settings)
      sent += r.sent
      skipped += r.skipped
    }

    if (schedule.source === 'cron') {
      await markDailyTaskRan(db, 'daily_reminders_last_run_date', todayStr)
    }

    return json({ sent, skipped, source: schedule.source, scheduled_time: schedule.scheduled_time })
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
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const cleanText = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()

async function loadSettings(db: ReturnType<typeof serviceClient>): Promise<Settings> {
  const { data } = await db.from('settings').select('key, value')
  const m: Record<string, unknown> = {}
  for (const s of data ?? []) m[s.key] = s.value
  return {
    reminder_days_before: Number(m.reminder_days_before ?? 2),
    email_due_soon: m.email_due_soon !== false,
    email_overdue: m.email_overdue !== false,
    late_fee_per_week: Number(m.late_fee_per_week ?? 0),
    admin_notification_email: String(m.admin_notification_email ?? 'ayalotlibrary@gmail.com').replace(/^"|"$/g, ''),
  }
}

async function dispatch(
  db: ReturnType<typeof serviceClient>,
  loans: LoanRow[],
  type: 'due_soon' | 'overdue',
  todayStr: string,
  settings: Settings,
): Promise<{ sent: number; skipped: number }> {
  let sent = 0
  let skipped = 0

  // Filter out loans already notified today (dedupe).
  const fresh: LoanRow[] = []
  for (const l of loans) {
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
    const textBody = `Hello ${member.name},\n\n${textIntro}\n\n${books.map((b) => `- "${b.title}"`).join('\n')}\n\nIf you need more time, please reply to this email or contact us at 053-520-9283 to request an extension before the due date — this way we can avoid any late fees (5 NIS per week, we start charging after the first week).\n\nThank you,\nThe Library Team\n\n---\nThis is an automated message sent by the Ayalot Library system.`

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
    html += `<p style="margin-top: 20px;">If you need more time, please <b>reply to this email</b> or contact us at <b>053-520-9283</b> to request an extension before the due date — this way we can avoid any late fees (5 NIS per week, we start charging after the first week).</p>`
    if (type === 'overdue' && settings.late_fee_per_week > 0)
      html += `<p>A late fee of ₪${settings.late_fee_per_week} per week may apply.</p>`
    html += `<p>Thank you,<br>The Library Team</p>`
    html += `<hr style="border: none; border-top: 1px solid #ccc; margin-top: 24px;"><p style="font-size: 12px; color: #888;">This is an automated message sent by the Ayalot Library system.</p>`

    const ok = await sendEmail({
      to: member.email,
      bcc: settings.admin_notification_email,
      subject,
      text: textBody,
      html,
    })
    if (ok) {
      for (const l of memberLoans) {
        await db.from('email_log').insert({
          type,
          recipient: member.email,
          loan_id: l.id,
          dedupe_key: `${type}:${l.id}:${todayStr}`,
        })
      }
      sent++
    }
  }

  return { sent, skipped }
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
