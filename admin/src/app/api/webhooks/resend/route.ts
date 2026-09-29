export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { logLeadEventByEmail } from "@/lib/db"
import { hmacSha256Base64, base64ToBytes, timingSafeEqual } from "@/lib/edge-crypto"

async function verifySvixSignature(
  body: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string
): Promise<boolean> {
  const secretBytes   = base64ToBytes(secret.replace(/^whsec_/, ""))
  const signedContent = `${svixId}.${svixTimestamp}.${body}`
  const expected      = await hmacSha256Base64(secretBytes, signedContent)

  return svixSignature
    .split(" ")
    .some(sig => {
      const [, b64] = sig.split(",")
      if (!b64) return false
      try {
        return timingSafeEqual(b64, expected)
      } catch {
        return false
      }
    })
}

const EVENT_MAP: Record<string, string> = {
  "email.opened":  "email_opened",
  "email.clicked": "email_clicked",
  "email.bounced": "email_bounced",
}

export async function POST(req: NextRequest) {
  const secret  = process.env.RESEND_WEBHOOK_SECRET
  const rawBody = await req.text()

  if (secret) {
    const svixId        = req.headers.get("svix-id") ?? ""
    const svixTimestamp = req.headers.get("svix-timestamp") ?? ""
    const svixSignature = req.headers.get("svix-signature") ?? ""

    if (!svixId || !svixTimestamp || !svixSignature ||
        !await verifySvixSignature(rawBody, svixId, svixTimestamp, svixSignature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }
  }

  const event     = JSON.parse(rawBody)
  const eventType = EVENT_MAP[event.type]
  const to        = event.data?.to?.[0]

  if (eventType && to) {
    await logLeadEventByEmail(to, eventType, {
      subject: event.data?.subject,
      ...(event.type === "email.clicked" ? { link: event.data?.click?.link } : {}),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
