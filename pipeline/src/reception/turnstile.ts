import type { IncomingMessage } from 'http'

// Cloudflare Turnstile verification + client-IP extraction, shared by anything
// public-facing that needs bot protection: the browser widget (browser-relay.ts)
// and the landing-page "paste your URL" preview flow (server.ts's /preview/start).

export function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]
  return (first ?? req.socket.remoteAddress ?? 'unknown').trim()
}

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.warn('[Turnstile] TURNSTILE_SECRET_KEY not set — skipping bot check (set before real launch)')
    return true
  }
  if (!token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ secret, response: token, remoteip: ip }),
    })
    const data = await res.json() as any
    return data?.success === true
  } catch (e: any) {
    console.warn('[Turnstile] verify error:', e.message)
    return false
  }
}
