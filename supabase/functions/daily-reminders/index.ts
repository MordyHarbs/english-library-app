// daily-reminders (TECH-PLAN D3) — run by pg_cron once a day (and callable
// manually for testing). Sends "due soon" and "overdue" emails, grouped per
// member, deduped so the same loan never triggers the same email twice in a day.
import { preflight, json } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/db.ts'
import { sendEmail } from '../_shared/email.ts'
import { addDays, jerusalemToday, fmt } from '../_shared/dates.ts'

interface LoanRow {
  id: string
  due_date: string
  member_id: string
  books: unknown
  members: unknown
}

Deno.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf
  try {
    const db = serviceClient()
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
        .select('id, due_date, member_id, books(title), members(name, email)')
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
        .select('id, due_date, member_id, books(title), members(name, email)')
        .is('date_returned', null)
        .lt('due_date', todayStr)
      const r = await dispatch(db, (data ?? []) as LoanRow[], 'overdue', todayStr, settings)
      sent += r.sent
      skipped += r.skipped
    }

    return json({ sent, skipped })
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
}

async function loadSettings(db: ReturnType<typeof serviceClient>): Promise<Settings> {
  const { data } = await db.from('settings').select('key, value')
  const m: Record<string, unknown> = {}
  for (const s of data ?? []) m[s.key] = s.value
  return {
    reminder_days_before: Number(m.reminder_days_before ?? 2),
    email_due_soon: m.email_due_soon !== false,
    email_overdue: m.email_overdue !== false,
    late_fee_per_week: Number(m.late_fee_per_week ?? 0),
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

    const items = memberLoans
      .map((l) => {
        const title = (l.books as { title: string } | null)?.title ?? 'book'
        return `<li>${title} — due ${l.due_date}</li>`
      })
      .join('')

    const subject =
      type === 'overdue' ? 'Overdue books — Ayalot Library' : 'Books due soon — Ayalot Library'
    let html = `<p>Hi ${member.name},</p><p>${
      type === 'overdue'
        ? 'These books are overdue — please return them soon:'
        : 'A friendly reminder — these are due back soon:'
    }</p><ul>${items}</ul>`
    if (type === 'overdue' && settings.late_fee_per_week > 0)
      html += `<p>A late fee of ₪${settings.late_fee_per_week} per week may apply.</p>`
    html += `<p>Thank you!<br>Ayalot Library</p>`

    const ok = await sendEmail({ to: member.email, subject, html })
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
