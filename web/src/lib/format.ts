import { format, isBefore, startOfDay, parseISO } from 'date-fns'

/** "Jun 23, 2026" */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return format(parseISO(d), 'MMM d, yyyy')
  } catch {
    return String(d)
  }
}

/** A loan is overdue if not returned and its due date is before today. */
export function isOverdue(dueDate: string, returned: string | null): boolean {
  if (returned) return false
  try {
    return isBefore(parseISO(dueDate), startOfDay(new Date()))
  } catch {
    return false
  }
}
