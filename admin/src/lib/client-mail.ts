// Transactional email for the client portal (Resend). Light, brand-matched, one clear button.

function shell(heading: string, body: string, cta: { label: string; url: string }, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F3F4F3;font-family:Inter,system-ui,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;">
  <div style="background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:32px;">
    <div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#00C26F,#0EA5E9);color:#fff;font-weight:800;text-align:center;line-height:36px;margin-bottom:22px;">W</div>
    <h1 style="margin:0 0 12px;font-size:22px;color:#0A0A0A;letter-spacing:-0.02em;">${heading}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4B5563;">${body}</p>
    <a href="${cta.url}" style="display:inline-block;background:#00C26F;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:9px;">${cta.label}</a>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#6B7280;">${footer}<br><span style="word-break:break-all;">${cta.url}</span></p>
  </div>
</div></body></html>`
}

async function send(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.warn("[client-mail] RESEND_API_KEY not set — email not sent"); return false }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.OUTREACH_FROM_EMAIL ?? "hello@webcrew.app", to, subject, html }),
    })
    if (!res.ok) console.warn("[client-mail] send failed", res.status)
    return res.ok
  } catch (e: any) { console.warn("[client-mail] error", e.message); return false }
}

export const adminBase = (reqUrl?: string) => (process.env.ADMIN_URL ?? (reqUrl ? new URL(reqUrl).origin : "http://localhost:3010")).replace(/\/$/, "")

export function sendResetEmail(to: string, url: string) {
  return send(to, "Reset your WebCrew password", shell("Reset your password", "Someone asked to reset the password for your WebCrew dashboard. Choose a new one with the button below. The link works once and expires in 1 hour.", { label: "Choose a new password", url }, "If you didn't ask for this, you can ignore this email — your password won't change."))
}

export function sendWelcomeCreatePassword(to: string, business: string, url: string) {
  return send(to, `Set up your ${business} dashboard`, shell(`Welcome to WebCrew`, `Your AI front office for <strong>${business}</strong> is being set up. Create a password to open your dashboard — you'll use your email and this password every time, and your browser will remember you. This link stays valid for 7 days.`, { label: "Create my password", url }, "If the link expires, use “Forgot password” on the sign-in page."))
}
