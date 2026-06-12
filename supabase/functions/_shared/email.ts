// Shared email sender. Prod: Gmail SMTP (free). Local: a plain SMTP host
// (e.g. Mailpit) with no auth. If neither is configured, it logs and skips so
// that callers (reservations, etc.) never fail just because email is down.
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

export interface EmailInput {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendEmail(input: EmailInput): Promise<boolean> {
  const gmailUser = Deno.env.get('GMAIL_USER')
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')
  const smtpHost = Deno.env.get('SMTP_HOST')

  let client: SMTPClient
  let from: string

  if (gmailUser && gmailPass) {
    from = gmailUser
    client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: { username: gmailUser, password: gmailPass },
      },
    })
  } else if (smtpHost) {
    from = gmailUser || 'library@localhost'
    client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: Number(Deno.env.get('SMTP_PORT') || '54325'),
        tls: false,
      },
    })
  } else {
    console.warn('[email] not configured — skipping send to', input.to)
    return false
  }

  try {
    await client.send({
      from: `Ayalot Library <${from}>`,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      content: input.text ?? input.subject,
      html: input.html,
    })
    await client.close()
    return true
  } catch (e) {
    console.error('[email] send failed:', (e as Error).message)
    return false
  }
}
