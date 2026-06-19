import { addDays, format, isAfter, parseISO, startOfDay } from 'date-fns'
import type { Setting } from './manage'

export const DEFAULT_EXTEND_DAYS = 7

export function numberSetting(
  settings: Setting[] | undefined,
  key: string,
  fallback: number,
) {
  const raw = settings?.find((setting) => setting.key === key)?.value
  const value = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(value) ? value : fallback
}

export function defaultExtendDays(settings: Setting[] | undefined) {
  const days = numberSetting(settings, 'default_extend_days', DEFAULT_EXTEND_DAYS)
  return days > 0 ? Math.round(days) : DEFAULT_EXTEND_DAYS
}

export function dueDateAfterDays(baseDate: string | undefined, days: number) {
  let base = startOfDay(new Date())
  if (baseDate) {
    const parsed = parseISO(baseDate)
    if (!Number.isNaN(parsed.getTime()) && isAfter(parsed, base)) base = parsed
  }
  return format(addDays(base, days), 'yyyy-MM-dd')
}