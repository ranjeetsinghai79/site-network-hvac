export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { createResetToken, findClientEmailByPhone, findClientLead, normEmail } from "@/lib/client-auth"
import { adminBase, sendResetEmail } from "@/lib/client-mail"

// Always answers the same way, whether or not an account exists, so this can't be used to probe who is a customer.
// `phone` covers "I forgot which email I signed up with": the link goes to the email already on file — it is never shown.
export async function POST(req: NextRequest) {
  const { email, phone } = await req.json().catch(() => ({})) as { email?: string; phone?: string }
  const generic = NextResponse.json({ ok: true })

  let target: string | null = null
  if (typeof email === "string" && email.includes("@")) target = (await findClientLead(email)) ? normEmail(email) : null
  else if (typeof phone === "string") target = await findClientEmailByPhone(phone)
  if (!target) return generic

  const token = await createResetToken(target, "reset", 60)
  if (token) await sendResetEmail(target, `${adminBase(req.url)}/client/reset/${token}`)
  return generic
}
