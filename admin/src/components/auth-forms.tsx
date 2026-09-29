"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"

const label = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 } as const
const input = { width: "100%", boxSizing: "border-box", fontSize: 15, padding: "11px 13px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--bg)", color: "var(--text)" } as const
const button = (busy: boolean) => ({ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--accent)", border: "none", borderRadius: 9, padding: "12px 16px", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }) as const

function Message({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <div role={ok ? "status" : "alert"} style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, borderRadius: 9, padding: "10px 12px", marginBottom: 16, color: ok ? "#047857" : "#B91C1C", background: ok ? "rgba(16,185,129,0.1)" : "rgba(220,38,38,0.08)" }}>{children}</div>
}

export function PasswordField({ id, label: text, value, onChange, autoComplete, autoFocus, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; autoFocus?: boolean; hint?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={id} style={label}>{text}</label>
      <div style={{ position: "relative" }}>
        <input id={id} name={id} type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} required
          style={{ ...input, paddingRight: 44 }} />
        <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"}
          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", padding: 8, display: "grid", placeItems: "center" }}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {hint && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{hint}</div>}
    </div>
  )
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  return { ok: res.ok, data: await res.json().catch(() => ({})) as any }
}

export function LoginForm({ notice }: { notice?: string | null }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const r = await post("/api/client/login", { email, password })
    if (r.ok) { window.location.href = r.data.next ?? "/client/dashboard"; return }
    setError(r.data.error ?? "Something went wrong. Try again."); setBusy(false)
  }
  return (
    <form onSubmit={submit}>
      {notice && !error && <Message ok={false}>{notice}</Message>}
      {error && <Message ok={false}>{error}</Message>}
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="email" style={label}>Email address</label>
        <input id="email" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" autoFocus required placeholder="owner@yourbusiness.com" style={input} />
      </div>
      <PasswordField id="password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
      <button type="submit" disabled={busy} style={button(busy)}>{busy ? <Loader2 size={16} className="spin" /> : null}{busy ? "Signing in…" : "Sign in"}</button>
      <div style={{ textAlign: "center", marginTop: 16 }}><a href="/client/forgot" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-light)", textDecoration: "none" }}>Forgot your password or email?</a></div>
    </form>
  )
}

export function ForgotForm() {
  const [mode, setMode] = useState<"email" | "phone">("email")
  const [value, setValue] = useState(""); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    await post("/api/client/forgot", mode === "email" ? { email: value } : { phone: value })
    setBusy(false); setSent(true)
  }
  if (sent) return <Message ok>If that matches a WebCrew account, we've emailed a link to reset your password to the address on file. It can take a minute — check your spam folder too. The link works for 1 hour.</Message>
  return (
    <form onSubmit={submit}>
      <div role="tablist" style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {([["email", "I know my email"], ["phone", "I forgot my email"]] as const).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setValue("") }}
            style={{ flex: 1, fontSize: 13, fontWeight: 700, borderRadius: 8, padding: "8px 10px", cursor: "pointer", border: "1px solid var(--border-2)", color: mode === k ? "#fff" : "var(--text-2)", background: mode === k ? "var(--accent)" : "var(--bg)" }}>{t}</button>
        ))}
      </div>
      <label htmlFor="who" style={label}>{mode === "email" ? "Email address" : "Business phone number"}</label>
      <input id="who" type={mode === "email" ? "email" : "tel"} value={value} onChange={e => setValue(e.target.value)} required autoFocus autoComplete={mode === "email" ? "email" : "tel"}
        placeholder={mode === "email" ? "owner@yourbusiness.com" : "(555) 123-4567"} style={{ ...input, marginBottom: 8 }} />
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
        {mode === "email" ? "We'll email you a link to choose a new password." : "Enter the phone number we have on file for your business. We'll send the reset link to the email address on your account."}
      </div>
      <button type="submit" disabled={busy || !value.trim()} style={button(busy)}>{busy ? <Loader2 size={16} /> : null}{busy ? "Sending…" : "Send reset link"}</button>
    </form>
  )
}

/** Create / reset a password. `token` present → reset or welcome link; absent → signed-in first-time setup. */
export function SetPasswordForm({ token, endpoint, cta }: { token?: string; endpoint: string; cta: string }) {
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("")
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (pw !== pw2) { setError("The two passwords don't match."); return }
    setBusy(true)
    const r = await post(endpoint, token ? { token, password: pw } : { password: pw })
    if (r.ok) { window.location.href = r.data.next ?? "/client/dashboard"; return }
    setError(r.data.error ?? "Something went wrong."); setBusy(false)
  }
  return (
    <form onSubmit={submit}>
      {error && <Message ok={false}>{error}</Message>}
      <PasswordField id="new-password" label="New password" value={pw} onChange={setPw} autoComplete="new-password" autoFocus hint="At least 10 characters. A short sentence works well." />
      <PasswordField id="confirm-password" label="Confirm password" value={pw2} onChange={setPw2} autoComplete="new-password" />
      <button type="submit" disabled={busy} style={button(busy)}>{busy ? "Saving…" : cta}</button>
    </form>
  )
}

export function AccountForms() {
  const [cur, setCur] = useState(""); const [next, setNext] = useState(""); const [next2, setNext2] = useState("")
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function change(e: FormEvent) {
    e.preventDefault(); setMsg(null)
    if (next !== next2) { setMsg({ ok: false, text: "The two new passwords don't match." }); return }
    setBusy(true)
    const r = await post("/api/client/change-password", { current: cur, next })
    setBusy(false)
    if (r.ok) { setMsg({ ok: true, text: "Password changed. Your other devices were signed out." }); setCur(""); setNext(""); setNext2("") }
    else setMsg({ ok: false, text: r.data.error ?? "Could not change password." })
  }
  async function everywhere() {
    if (!confirm("Sign out of every device, including this one?")) return
    await post("/api/client/logout-all", {}); window.location.href = "/client/login"
  }
  return (
    <>
      <form onSubmit={change} style={{ maxWidth: 400 }}>
        {msg && <Message ok={msg.ok}>{msg.text}</Message>}
        <PasswordField id="current-password" label="Current password" value={cur} onChange={setCur} autoComplete="current-password" />
        <PasswordField id="acct-new" label="New password" value={next} onChange={setNext} autoComplete="new-password" hint="At least 10 characters." />
        <PasswordField id="acct-new2" label="Confirm new password" value={next2} onChange={setNext2} autoComplete="new-password" />
        <button type="submit" disabled={busy} style={{ ...button(busy), width: "auto", padding: "10px 20px", fontSize: 14 }}>{busy ? "Saving…" : "Change password"}</button>
      </form>
      <button onClick={everywhere} style={{ marginTop: 22, fontSize: 13, fontWeight: 600, color: "var(--muted)", background: "transparent", border: "1px solid var(--border-2)", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Sign out of all devices</button>
    </>
  )
}
