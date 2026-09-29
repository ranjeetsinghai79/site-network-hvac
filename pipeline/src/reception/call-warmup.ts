import type { GeminiLiveSession } from './gemini-live.js'
import type { getReceptionConfigById } from './db.js'

export interface WarmCallEntry {
  session:    GeminiLiveSession
  configData: NonNullable<Awaited<ReturnType<typeof getReceptionConfigById>>>
}

// callSid → promise that resolves when Gemini is connected and config is loaded.
// Populated in /voice HTTP handler, consumed in WebSocket start handler.
export const pendingCalls = new Map<string, Promise<WarmCallEntry>>()

// Clean up stale entries (calls that never connected or already consumed)
const STALE_MS = 30_000
const timestamps = new Map<string, number>()

export function registerPending(callSid: string, p: Promise<WarmCallEntry>) {
  pendingCalls.set(callSid, p)
  timestamps.set(callSid, Date.now())
  p.catch(() => { /* warmup failure handled at consumption */ })
}

export function consumePending(callSid: string): Promise<WarmCallEntry> | undefined {
  const entry = pendingCalls.get(callSid)
  pendingCalls.delete(callSid)
  timestamps.delete(callSid)
  return entry
}

// Prune stale entries every 60s
setInterval(() => {
  const cutoff = Date.now() - STALE_MS
  for (const [sid, ts] of timestamps) {
    if (ts < cutoff) {
      pendingCalls.delete(sid)
      timestamps.delete(sid)
      console.log(`[Warmup] Pruned stale entry for ${sid}`)
    }
  }
}, 60_000)
