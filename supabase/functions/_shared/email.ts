// Shared email sender.
//   PROD:  Gmail SMTP via denomailer (TLS + app password) — its supported path.
//   LOCAL: a tiny raw plaintext SMTP sender for Mailpit (no TLS / no auth), which
//          avoids denomailer's "won't auth over insecure" guard.
//   Neither configured -> log + skip, so callers never fail on email.
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

export interface EmailInput {
  to: string
  bcc?: string
  fromName?: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendEmail(input: EmailInput): Promise<boolean> {
  const gmailUser = Deno.env.get('GMAIL_USER')
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')
  const smtpHost = Deno.env.get('SMTP_HOST')
  const fromName = headerText(input.fromName || Deno.env.get('LIBRARY_NAME') || 'Ayalot Library')
  const html = input.html.trim()

  try {
    if (gmailUser && gmailPass) {
      const client = new SMTPClient({
        connection: {
          hostname: 'smtp.gmail.com',
          port: 465,
          tls: true,
          auth: { username: gmailUser, password: gmailPass },
        },
      })
      await client.send({
        from: `${fromName} <${gmailUser}>`,
        to: input.to,
        bcc: input.bcc,
        replyTo: input.replyTo,
        subject: input.subject,
        content: input.text ?? input.subject,
        html,
      })
      await client.close()
      return true
    }

    if (smtpHost) {
      const from = gmailUser || Deno.env.get('ADMIN_EMAIL') || 'noreply@library.example'
      await sendPlain(
        smtpHost,
        Number(Deno.env.get('SMTP_PORT') || '54325'),
        from,
        fromName,
        input,
      )
      return true
    }

    console.warn('[email] not configured — skipping send to', input.to)
    return false
  } catch (e) {
    console.error('[email] send failed:', (e as Error).message)
    return false
  }
}

function headerText(value: string) {
  return value.replace(/[\r\n"]/g, '').trim() || 'Library'
}

/** Minimal plaintext SMTP (good enough for Mailpit / local testing). */
async function sendPlain(host: string, port: number, from: string, fromName: string, input: EmailInput) {
  const conn = await Deno.connect({ hostname: host, port })
  const enc = new TextEncoder()
  const dec = new TextDecoder()
  const buf = new Uint8Array(8192)
  const read = async () => {
    const n = await conn.read(buf)
    return dec.decode(buf.subarray(0, n ?? 0))
  }
  const cmd = async (line: string) => {
    await conn.write(enc.encode(line + '\r\n'))
    return read()
  }
  try {
    await read() // server greeting
    await cmd('EHLO library.local')
    await cmd(`MAIL FROM:<${from}>`)
    await cmd(`RCPT TO:<${input.to}>`)
    if (input.bcc) await cmd(`RCPT TO:<${input.bcc}>`)
    await cmd('DATA')
    const headers = [
      `From: ${fromName} <${from}>`,
      `To: ${input.to}`,
      input.replyTo ? `Reply-To: ${input.replyTo}` : '',
      `Subject: ${input.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
    ]
      .filter(Boolean)
      .join('\r\n')
    // Dot-stuff any lines beginning with '.' per RFC 5321.
    const body = input.html.trim().replace(/\r?\n/g, '\r\n').replace(/\r\n\./g, '\r\n..')
    await cmd(`${headers}\r\n\r\n${body}\r\n.`)
    await cmd('QUIT')
  } finally {
    conn.close()
  }
}
