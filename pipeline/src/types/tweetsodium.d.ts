declare module 'tweetsodium' {
  export function seal(message: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array
  export function open(box: Uint8Array, recipientPublicKey: Uint8Array, recipientSecretKey: Uint8Array): Uint8Array | null
}
