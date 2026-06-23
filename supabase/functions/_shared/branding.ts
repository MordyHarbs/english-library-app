import { serviceClient } from './db.ts'

export interface BrandingSettings {
  libraryName: string
  logoUrl: string
  iconUrl: string
  contactPhone: string
  backupFolderName: string
  siteUrl: string
  adminNotificationEmail: string
}

const DEFAULT_BRANDING: BrandingSettings = {
  libraryName: 'Ayalot Library',
  logoUrl: '/logo.png',
  iconUrl: '/favicon.png',
  contactPhone: '053-520-9283',
  backupFolderName: 'Ayalot Library Backups',
  siteUrl: 'http://localhost:5173',
  adminNotificationEmail: 'ayalotlibrary@gmail.com',
}

const BRANDING_KEYS = [
  'library_name',
  'library_logo_url',
  'library_icon_url',
  'contact_phone',
  'backup_folder_name',
  'site_url',
  'admin_notification_email',
]

export async function loadBranding(db: ReturnType<typeof serviceClient>): Promise<BrandingSettings> {
  const { data } = await db
    .from('settings')
    .select('key, value')
    .in('key', BRANDING_KEYS)
  const map: Record<string, unknown> = {}
  for (const setting of data ?? []) map[setting.key] = setting.value

  const siteUrl = cleanUrl(stringSetting(map.site_url, DEFAULT_BRANDING.siteUrl))
  const logoUrl = stringSetting(map.library_logo_url, DEFAULT_BRANDING.logoUrl)
  return {
    libraryName: stringSetting(map.library_name, DEFAULT_BRANDING.libraryName),
    logoUrl: absoluteUrl(siteUrl, logoUrl),
    iconUrl: absoluteUrl(siteUrl, stringSetting(map.library_icon_url, DEFAULT_BRANDING.iconUrl)),
    contactPhone: stringSetting(map.contact_phone, DEFAULT_BRANDING.contactPhone, true),
    backupFolderName: stringSetting(map.backup_folder_name, DEFAULT_BRANDING.backupFolderName),
    siteUrl,
    adminNotificationEmail: stringSetting(
      map.admin_notification_email,
      DEFAULT_BRANDING.adminNotificationEmail,
    ),
  }
}

function stringSetting(value: unknown, fallback: string, allowEmpty = false) {
  const text = String(value ?? fallback).replace(/^"|"$/g, '').trim()
  if (allowEmpty && value !== undefined && value !== null) return text
  return text || fallback
}

function cleanUrl(value: string) {
  return value.replace(/\/$/, '')
}

function absoluteUrl(siteUrl: string, value: string) {
  if (/^(https?:|data:)/i.test(value)) return value
  if (value.startsWith('/')) return `${siteUrl}${value}`
  return value
}
