import { fmt, jerusalemToday } from './dates.ts'
import type { serviceClient } from './db.ts'

const DEFAULT_DAILY_TASKS_TIME = '08:00'

interface ScheduleDecision {
  shouldRun: boolean
  source: string
  today: string
  scheduled_time: string
  reason?: string
}

export async function shouldRunDailyTask(
  req: Request,
  db: ReturnType<typeof serviceClient>,
  lastRunKey: string,
): Promise<ScheduleDecision> {
  const source = await requestSource(req)
  const today = fmt(jerusalemToday())
  const scheduledTime = await loadDailyTasksTime(db)

  if (source !== 'cron') {
    return { shouldRun: true, source, today, scheduled_time: scheduledTime }
  }

  const nowMinutes = jerusalemMinutesNow()
  const scheduledMinutes = timeToMinutes(scheduledTime)
  if (nowMinutes < scheduledMinutes) {
    return {
      shouldRun: false,
      source,
      today,
      scheduled_time: scheduledTime,
      reason: 'before scheduled time',
    }
  }

  const lastRun = await loadSettingString(db, lastRunKey)
  if (lastRun === today) {
    return {
      shouldRun: false,
      source,
      today,
      scheduled_time: scheduledTime,
      reason: 'already ran today',
    }
  }

  return { shouldRun: true, source, today, scheduled_time: scheduledTime }
}

export async function markDailyTaskRan(
  db: ReturnType<typeof serviceClient>,
  lastRunKey: string,
  today: string,
) {
  const { error } = await db.from('settings').upsert({
    key: lastRunKey,
    value: today,
    description: 'Last successful scheduled run date. Used to prevent duplicate daily cron runs.',
  })
  if (error) throw error
}

async function requestSource(req: Request) {
  try {
    const body = await req.clone().json()
    return String(body?.source ?? 'manual')
  } catch {
    return 'manual'
  }
}

async function loadDailyTasksTime(db: ReturnType<typeof serviceClient>) {
  return normalizeTime(await loadSettingString(db, 'daily_tasks_time'))
}

async function loadSettingString(db: ReturnType<typeof serviceClient>, key: string) {
  const { data } = await db.from('settings').select('value').eq('key', key).maybeSingle()
  const value = data?.value
  return typeof value === 'string' ? value : String(value ?? '')
}

function normalizeTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : DEFAULT_DAILY_TASKS_TIME
}

function timeToMinutes(value: string) {
  const [hours, minutes] = normalizeTime(value).split(':').map(Number)
  return hours * 60 + minutes
}

function jerusalemMinutesNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}