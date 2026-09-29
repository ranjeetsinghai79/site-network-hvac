import { hmacSha256Hex, timingSafeEqual } from '@/lib/edge-crypto'

export type PlatformRole = 'owner' | 'operator' | 'specialist' | 'approver' | 'client'

export interface PlatformSession {
  agencyId: string
  email: string
  role: PlatformRole
  exp: number
}

function secret(): string {
  const value = process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD
  if (value) return value
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is required')
  return 'dev-only-insecure-secret'
}

function encode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

export async function signPlatformSession(input: Omit<PlatformSession, 'exp'>, maxAgeSec = 60 * 60 * 24 * 7): Promise<string> {
  const payload = encode(JSON.stringify({ ...input, email: input.email.toLowerCase(), exp: Math.floor(Date.now() / 1000) + maxAgeSec }))
  const signature = await hmacSha256Hex(secret(), payload)
  return `${payload}.${signature}`
}

export async function verifyPlatformSession(value: string | null | undefined): Promise<PlatformSession | null> {
  if (!value) return null
  const separator = value.lastIndexOf('.')
  if (separator < 1) return null
  const payload = value.slice(0, separator)
  const signature = value.slice(separator + 1)
  const expected = await hmacSha256Hex(secret(), payload)
  if (!timingSafeEqual(signature, expected)) return null
  try {
    const parsed = JSON.parse(decode(payload)) as PlatformSession
    if (!parsed.agencyId || !parsed.email || !parsed.role || parsed.exp <= Math.floor(Date.now() / 1000)) return null
    return parsed
  } catch {
    return null
  }
}
