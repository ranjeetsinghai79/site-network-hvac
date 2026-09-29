const encoder = new TextEncoder()
const decoder = new TextDecoder()

function base64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function keyFromSecret(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret))
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
}

function encryptionSecret(): string {
  const secret = process.env.INTEGRATION_TOKEN_SECRET || process.env.SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error("INTEGRATION_TOKEN_SECRET or SESSION_SECRET must be at least 16 characters")
  }
  return secret
}

export async function encryptSecretJson(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await keyFromSecret(encryptionSecret())
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(value))
  )
  return `v1:${base64Url(iv)}:${base64Url(new Uint8Array(cipher))}`
}

export async function decryptSecretJson<T>(value: string): Promise<T> {
  const [version, ivValue, cipherValue] = value.split(":")
  if (version !== "v1" || !ivValue || !cipherValue) throw new Error("Invalid encrypted secret payload")
  const key = await keyFromSecret(encryptionSecret())
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivValue) as unknown as BufferSource },
    key,
    fromBase64Url(cipherValue) as unknown as BufferSource
  )
  return JSON.parse(decoder.decode(plain)) as T
}
