// Web Crypto API helpers for CF Workers edge runtime — no Node.js dependencies

export async function hmacSha256Hex(key: string | Uint8Array, data: string): Promise<string> {
  const keyData = typeof key === "string" ? new TextEncoder().encode(key) : key
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData as unknown as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data) as unknown as ArrayBuffer)
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, "0")).join("")
}

export async function hmacSha256Base64(key: Uint8Array, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key as unknown as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data) as unknown as ArrayBuffer)
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

export async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data) as unknown as ArrayBuffer)
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("")
}

export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("")
}

export function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
