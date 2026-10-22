import { addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Database } from './database.types'
import type { Setting } from './manage'
import { numberSetting } from './settings'

export type MembershipPayment = Database['public']['Tables']['membership_payments']['Row']
export type MembershipFreeze = Database['public']['Tables']['membership_freezes']['Row']

export const DEFAULT_MEMBERSHIP_MONTHS = 12
const EXPIRING_SOON_DAYS = 30

export function membershipTracking(settings: Setting[] | undefined) {
  return settings?.find((s) => s.key === 'membership_tracking')?.value === true
}

export function membershipMonths(settings: Setting[] | undefined) {
  const months = numberSetting(settings, 'membership_period_months', DEFAULT_MEMBERSHIP_MONTHS)
  return months > 0 ? Math.round(months) : DEFAULT_MEMBERSHIP_MONTHS
}

export function membershipFee(settings: Setting[] | undefined) {
  return Math.max(0, numberSetting(settings, 'membership_fee', 0))
}

/** Suggested "valid until" date: the period start plus the configured months. */
export function suggestPeriodEnd(periodStart: string, months: number) {
  const start = parseISO(periodStart)
  if (Number.isNaN(start.getTime())) return ''
  return format(addMonths(start, months), 'yyyy-MM-dd')
}

export type MembershipState = 'active' | 'expiring' | 'expired' | 'none' | 'frozen'

export interface MembershipStatus {
  state: MembershipState
  /** The payment that determines the status (covering today, else the latest). */
  payment: MembershipPayment | null
  daysLeft: number | null
  /** The freeze in effect today, when state is 'frozen'. */
  freeze?: MembershipFreeze
}

/** A freeze covers today from its start date through its end date (open-ended if none). */
export function activeFreeze(freezes: MembershipFreeze[] | undefined, today: string) {
  return freezes?.find((f) => f.start_date <= today && (!f.end_date || today <= f.end_date))
}

export function membershipStatus(
  payments: MembershipPayment[] | undefined,
  today: string,
  freezes?: MembershipFreeze[],
): MembershipStatus {
  // A frozen member doesn't need to pay while the freeze lasts.
  const freeze = activeFreeze(freezes, today)
  if (freeze) return { state: 'frozen', payment: null, daysLeft: null, freeze }
  if (!payments || payments.length === 0) return { state: 'none', payment: null, daysLeft: null }
  const covering = payments
    .filter((p) => p.period_start <= today && today <= p.period_end)
    .sort((a, b) => (a.period_end < b.period_end ? 1 : -1))[0]
  if (covering) {
    const daysLeft = differenceInCalendarDays(parseISO(covering.period_end), parseISO(today))
    return {
      state: daysLeft <= EXPIRING_SOON_DAYS ? 'expiring' : 'active',
      payment: covering,
      daysLeft,
    }
  }
  // Payments that haven't started yet don't count as expiry history.
  const started = payments.filter((p) => p.period_start <= today)
  if (started.length === 0) return { state: 'none', payment: null, daysLeft: null }
  const latest = started.sort((a, b) => (a.period_end < b.period_end ? 1 : -1))[0]
  return {
    state: 'expired',
    payment: latest,
    daysLeft: differenceInCalendarDays(parseISO(latest.period_end), parseISO(today)),
  }
}

/** All payments and freezes, grouped by member id (admin only). Small tables for a small library. */
export function useMembershipOverview(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['admin', 'membershipPayments', 'all'],
    queryFn: async () => {
      const [pay, frz] = await Promise.all([
        supabase.from('membership_payments').select('*').order('period_end', { ascending: false }),
        supabase.from('membership_freezes').select('*').order('start_date', { ascending: false }),
      ])
      if (pay.error) throw pay.error
      if (frz.error) throw frz.error
      const group = <T extends { member_id: string }>(rows: T[]) => {
        const map = new Map<string, T[]>()
        for (const row of rows) map.set(row.member_id, [...(map.get(row.member_id) ?? []), row])
        return map
      }
      return { payments: group(pay.data ?? []), freezes: group(frz.data ?? []) }
    },
  })
}
