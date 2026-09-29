// mulaw (u-law) ↔ PCM 16-bit conversion + sample rate conversion
// Twilio sends:  mulaw 8kHz  → decode → upsample → 16kHz PCM for Gemini
// Gemini sends: 24kHz PCM  → downsample → encode → mulaw 8kHz for Twilio

const MULAW_BIAS = 0x84
const MULAW_CLIP = 32635

// Precompute decode table
const MULAW_DECODE = new Int16Array(256)
for (let i = 0; i < 256; i++) {
  const uval = ~i & 0xFF
  const sign = uval & 0x80
  const exp = (uval >> 4) & 0x07
  const mantissa = uval & 0x0f
  let sample = ((mantissa << 3) + MULAW_BIAS) << exp
  sample -= MULAW_BIAS
  MULAW_DECODE[i] = sign ? -sample : sample
}

// mulaw byte → PCM 16-bit
export function mulawDecode(buf: Buffer): Int16Array {
  const out = new Int16Array(buf.length)
  for (let i = 0; i < buf.length; i++) out[i] = MULAW_DECODE[buf[i]]
  return out
}

// PCM 16-bit → mulaw byte
export function mulawEncode(pcm: Int16Array): Buffer {
  const out = Buffer.allocUnsafe(pcm.length)
  for (let i = 0; i < pcm.length; i++) {
    let s = pcm[i]
    const sign = s < 0 ? 0x80 : 0
    if (s < 0) s = -s
    if (s > MULAW_CLIP) s = MULAW_CLIP
    s += MULAW_BIAS
    let exp = 7
    for (let mask = 0x4000; (s & mask) === 0 && exp > 0; exp--, mask >>= 1) {}
    out[i] = ~(sign | (exp << 4) | ((s >> (exp + 3)) & 0x0f)) & 0xFF
  }
  return out
}

// 8kHz → 16kHz (linear interpolation, doubles sample count)
export function upsample8to16(pcm: Int16Array): Int16Array {
  const out = new Int16Array(pcm.length * 2)
  for (let i = 0; i < pcm.length; i++) {
    out[i * 2] = pcm[i]
    out[i * 2 + 1] = Math.round((pcm[i] + (i + 1 < pcm.length ? pcm[i + 1] : pcm[i])) / 2)
  }
  return out
}

// 24kHz → 8kHz (average every 3 samples, reduces to 1/3)
export function downsample24to8(pcm: Int16Array): Int16Array {
  const len = Math.floor(pcm.length / 3)
  const out = new Int16Array(len)
  for (let i = 0; i < len; i++) {
    out[i] = Math.round((pcm[i * 3] + pcm[i * 3 + 1] + pcm[i * 3 + 2]) / 3)
  }
  return out
}

// Int16Array → little-endian Buffer
export function pcmToBuffer(pcm: Int16Array): Buffer {
  const buf = Buffer.allocUnsafe(pcm.length * 2)
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(pcm[i], i * 2)
  return buf
}

// Little-endian Buffer → Int16Array
export function bufferToPcm(buf: Buffer): Int16Array {
  const out = new Int16Array(buf.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2)
  return out
}

// Twilio base64 mulaw 8kHz → base64 PCM 16kHz for Gemini input
export function twilioToGeminiAudio(base64Mulaw: string): string {
  const mulaw = Buffer.from(base64Mulaw, 'base64')
  const pcm8 = mulawDecode(mulaw)
  const pcm16 = upsample8to16(pcm8)
  return pcmToBuffer(pcm16).toString('base64')
}

// Gemini base64 PCM 24kHz → base64 mulaw 8kHz for Twilio playback
export function geminiToTwilioAudio(base64Pcm24: string): string {
  const raw = Buffer.from(base64Pcm24, 'base64')
  const pcm24 = bufferToPcm(raw)
  const pcm8 = downsample24to8(pcm24)
  const mulaw = mulawEncode(pcm8)
  return mulaw.toString('base64')
}
