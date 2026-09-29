export type VoiceFallbackMode = 'inbound' | 'outbound'

export function buildVoiceFallbackUrl(configId: string, mode: VoiceFallbackMode, recoveryAttempt = 1): string {
  const base = (process.env.RECEPTION_BASE_URL ?? 'https://ai-reception-459352382653.us-central1.run.app').replace(/\/+$/, '')
  const url = new URL(`${base}/voice/${encodeURIComponent(configId)}`)
  url.searchParams.set('recovery', String(recoveryAttempt))
  if (mode === 'outbound') url.searchParams.set('outbound', '1')
  return url.toString()
}

/**
 * Move an already-answered Twilio call away from a failed Media Stream and
 * into the turn-based voice assistant. Safe to call more than once only when
 * the caller supplies an idempotency guard; Twilio itself does not dedupe call
 * updates.
 */
export async function redirectCallToVoiceFallback(options: {
  callSid: string
  configId: string
  mode: VoiceFallbackMode
  reason: string
  recoveryAttempt?: number
  fetchImpl?: typeof fetch
}): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) {
    console.error(`[Fallback] Cannot redirect ${options.callSid}: Twilio credentials are missing`)
    return false
  }

  const fallbackUrl = buildVoiceFallbackUrl(options.configId, options.mode, options.recoveryAttempt)
  const request = options.fetchImpl ?? fetch
  try {
    const response = await request(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${encodeURIComponent(options.callSid)}.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ Url: fallbackUrl, Method: 'POST' }).toString(),
      },
    )
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error(`[Fallback] Twilio redirect failed for ${options.callSid}: ${response.status} ${detail.slice(0, 300)}`)
      return false
    }
    console.warn(`[Fallback] Redirected ${options.callSid} to ${options.mode} voice fallback | reason=${options.reason}`)
    return true
  } catch (error: any) {
    console.error(`[Fallback] Redirect error for ${options.callSid}: ${error?.message ?? error}`)
    return false
  }
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
