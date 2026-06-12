// Date helpers for Edge Functions (Asia/Jerusalem, the library's timezone).

/** Today's calendar date in Jerusalem, as a UTC-midnight Date. */
export function jerusalemToday(): Date {
  // en-CA formats as YYYY-MM-DD.
  const s = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
  return new Date(s + 'T00:00:00Z')
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

/** YYYY-MM-DD */
export function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}
