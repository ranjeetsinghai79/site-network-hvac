"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, PhoneForwarded, CalendarCheck, PhoneCall, Bell } from "lucide-react"

type Hours = Record<string, [string, string] | null>
interface CalendarProps {
  connected: boolean
  googleAvailable: boolean
  provider: "google" | "cal" | null
  googleEmail: string | null
  timezone: string | null
  settings: { durationMin?: number; hours?: Hours } | null
  notice: string | null
  noticeCode: string | null
}

interface Props {
  aiNumber: string | null
  hasCalls: boolean
  calendar: CalendarProps
  transferPhone: string | null
  fallbackTransfer: string | null
  alertEmail: string | null
  alertPhone: string | null
}

const pretty = (n: string | null) => (n ? n.replace(/^\+?1?(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "")
const digits = (n: string) => n.replace(/\D/g, "").replace(/^1/, "")

const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "22px 28px", marginBottom: 20 } as const
const rowStyle = { display: "flex", gap: 14, padding: "14px 0", borderTop: "1px solid var(--border)" } as const
const label = { fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 } as const
const help = { fontSize: 12, color: "var(--muted)", lineHeight: 1.5 } as const

function Pill({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap",
      color: ok ? "#047857" : "#B45309", background: ok ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.14)" }}>
      {ok ? yes : no}
    </span>
  )
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
const DAY_LABEL: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" }
const TIMES = Array.from({ length: 33 }, (_, i) => { const m = 5 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}` })
const timeLabel = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}` }

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  connected:   { ok: true,  text: "Calendar connected. Your AI can now book, move and cancel appointments." },
  denied:      { ok: false, text: "You cancelled the Google sign-in — nothing was connected. You can try again any time." },
  scope:       { ok: false, text: "Google needs permission to manage calendar events so the AI can book. Please try again and leave the calendar box ticked." },
  retry:       { ok: false, text: "Google didn't finish the connection. Please try once more." },
  error:       { ok: false, text: "We couldn't connect your calendar. Please try again, or message us and we'll help." },
  unavailable: { ok: false, text: "Calendar connection isn't available on your account yet — message us and we'll set it up." },
}

function CalendarRow({ calendar }: { calendar: CalendarProps }) {
  const router = useRouter()
  const initial = calendar.settings?.hours ?? { mon: ["08:00", "17:00"], tue: ["08:00", "17:00"], wed: ["08:00", "17:00"], thu: ["08:00", "17:00"], fri: ["08:00", "17:00"], sat: null, sun: null }
  const firstOpen = DAY_KEYS.map(d => initial[d]).find(Boolean) ?? ["08:00", "17:00"]
  const [duration, setDuration] = useState(calendar.settings?.durationMin ?? 60)
  const [days, setDays] = useState<Record<string, boolean>>(Object.fromEntries(DAY_KEYS.map(d => [d, !!initial[d]])))
  const [from, setFrom] = useState(firstOpen[0]); const [to, setTo] = useState(firstOpen[1])
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const code = calendar.noticeCode
  const notice = calendar.notice ? NOTICES[calendar.notice] : null
  const select = { fontSize: 13, padding: "6px 8px", borderRadius: 7, border: "1px solid var(--border-2)", background: "var(--bg)", color: "var(--text)" } as const

  async function save() {
    setBusy(true); setMsg(null)
    const hours = Object.fromEntries(DAY_KEYS.map(d => [d, days[d] ? [from, to] : null]))
    const res = await fetch("/api/client/calendar-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ durationMin: duration, hours }) })
    const data = await res.json().catch(() => ({}))
    setBusy(false); setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: data.error ?? "Could not save." })
    if (res.ok) router.refresh()
  }
  async function disconnect() {
    if (!confirm("Disconnect your calendar? The AI will take messages instead of booking until you reconnect.")) return
    setBusy(true); await fetch("/api/client/google/disconnect", { method: "POST" }); setBusy(false); router.refresh()
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={label}>Appointment booking</span>
        <Pill ok={calendar.connected} yes={calendar.provider === "google" ? "Google Calendar connected" : "Calendar connected"} no="Not connected" />
      </div>
      {notice && <div role="status" style={{ margin: "6px 0", fontSize: 12, fontWeight: 600, color: notice.ok ? "#047857" : "#B91C1C" }}>{notice.text}{!notice.ok && code ? <span style={{ fontWeight: 500, color: "var(--muted)" }}> (support code: {code})</span> : null}</div>}

      {!calendar.connected && (
        <>
          {!calendar.googleAvailable ? (
            <div style={{ ...help, margin: "4px 0 0" }}>Until your calendar is connected the AI takes messages instead of booking. <a href="/client/support" style={{ color: "var(--accent-light)", fontWeight: 600 }}>Ask us to connect it</a> — it takes us a minute.</div>
          ) : (<>
          <div style={{ ...help, margin: "4px 0 10px" }}>Until your calendar is connected the AI takes messages instead of booking. Connect it in one click — you&apos;ll sign in with Google, the same way you sign in to Gmail. The AI only creates and manages the appointments it books; it can&apos;t read anything else.</div>
          <a href="/api/client/google/start" style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, color: "#3C4043", background: "#fff", border: "1px solid #DADCE0", borderRadius: 8, padding: "9px 16px", textDecoration: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
            Connect Google Calendar
          </a>
          </>)}
        </>
      )}

      {calendar.connected && (
        <>
          <div style={{ ...help, margin: "4px 0 12px" }}>
            {calendar.googleEmail ? <>Signed in as <strong style={{ color: "var(--text)" }}>{calendar.googleEmail}</strong>. </> : null}
            The AI books, moves and cancels appointments here, checks your existing events so it never double-books, and texts reminders.
          </div>
          {calendar.provider === "google" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label htmlFor="appt-len" style={{ ...help, minWidth: 110 }}>Appointment length</label>
                <select id="appt-len" value={duration} onChange={e => setDuration(Number(e.target.value))} style={select}>
                  {[30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m >= 60 ? `${m / 60} hr${m > 60 ? "s" : ""}`.replace("1.5 hrs", "1½ hrs") : `${m} min`}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ ...help, minWidth: 110 }}>Days it can book</span>
                {DAY_KEYS.map(d => (
                  <label key={d} style={{ fontSize: 12, fontWeight: 600, color: days[d] ? "var(--text)" : "var(--muted)", background: days[d] ? "var(--accent-dim-2)" : "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 6, padding: "4px 9px", cursor: "pointer" }}>
                    <input type="checkbox" checked={days[d]} onChange={e => setDays({ ...days, [d]: e.target.checked })} style={{ marginRight: 5 }} />{DAY_LABEL[d]}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ ...help, minWidth: 110 }}>Between</span>
                <select aria-label="Opening time" value={from} onChange={e => setFrom(e.target.value)} style={select}>{TIMES.map(t => <option key={t} value={t}>{timeLabel(t)}</option>)}</select>
                <span style={help}>and</span>
                <select aria-label="Closing time" value={to} onChange={e => setTo(e.target.value)} style={select}>{TIMES.map(t => <option key={t} value={t}>{timeLabel(t)}</option>)}</select>
                {calendar.timezone && <span style={help}>({calendar.timezone.replace("_", " ")})</span>}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            {calendar.provider === "google" && (
              <button onClick={save} disabled={busy} style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 16px", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>Save booking settings</button>
            )}
            {calendar.provider === "google" && (
              <button onClick={disconnect} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", background: "transparent", border: "1px solid var(--border-2)", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>Disconnect</button>
            )}
            {msg && <span role="status" style={{ fontSize: 12, fontWeight: 600, color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</span>}
          </div>
        </>
      )}
    </>
  )
}

export function ClientSetupCard({ aiNumber, hasCalls, calendar, transferPhone, fallbackTransfer, alertEmail, alertPhone }: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [transfer, setTransfer] = useState(transferPhone ? pretty(transferPhone) : "")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const ai = aiNumber ? digits(aiNumber) : ""

  async function copy() {
    if (!aiNumber) return
    try { await navigator.clipboard.writeText(aiNumber); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* clipboard blocked */ }
  }

  async function saveTransfer() {
    setSaving(true); setMsg(null)
    const res = await fetch("/api/client/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transferPhone: transfer }) })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (res.ok) { setMsg({ ok: true, text: "Saved. New calls transfer to this number." }); setTransfer(pretty(data.transferPhone)); router.refresh() }
    else setMsg({ ok: false, text: data.error ?? "Could not save." })
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <PhoneCall size={16} color="var(--accent)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Your AI Front Office</span>
        <Pill ok={hasCalls} yes="Answering calls" no="Waiting for your first call" />
      </div>
      <div style={{ ...help, marginBottom: 14 }}>
        {hasCalls ? "Your receptionist is live. Everything below is what it needs to run at full strength." : "Two minutes of setup and it starts answering the calls you miss."}
      </div>

      {/* AI number + forwarding */}
      <div style={rowStyle}>
        <PhoneForwarded size={18} color="var(--accent-light)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={label}>Your AI receptionist number</div>
          {aiNumber ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}>{pretty(aiNumber)}</span>
                <button onClick={copy} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-2)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div style={help}>Forward your business phone to this number. Customers keep dialing the number they already know — the AI answers when you can&apos;t.</div>
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-light)", cursor: "pointer" }}>How to forward your business number</summary>
                <div style={{ ...help, marginTop: 10, display: "grid", gap: 10 }}>
                  <div><strong style={{ color: "var(--text)" }}>Recommended: forward only when you don&apos;t answer.</strong> You still pick up when you can; the AI catches the rest.</div>
                  <div>
                    <div>Verizon: dial <code>*71{ai}</code> &nbsp;·&nbsp; turn off: <code>*73</code></div>
                    <div>AT&amp;T, T-Mobile and most other mobile carriers: dial <code>**61*{ai ? `+1${ai}` : ""}#</code> &nbsp;·&nbsp; turn off: <code>##61#</code></div>
                    <div>Landline or VoIP (RingCentral, Google Voice, Ooma, Spectrum…): in your provider&apos;s settings, set <em>call forwarding when unanswered</em> to {pretty(aiNumber)}.</div>
                  </div>
                  <div><strong style={{ color: "var(--text)" }}>Or forward every call:</strong> Verizon <code>*72{ai}</code> (off <code>*73</code>) · AT&amp;T / T-Mobile <code>**21*{ai ? `+1${ai}` : ""}#</code> (off <code>##21#</code>).</div>
                  <div>Codes vary by carrier. If one doesn&apos;t work, ask your carrier for &ldquo;conditional call forwarding on no answer&rdquo; to {pretty(aiNumber)}. Then call your business number from another phone and don&apos;t answer — the call appears here within a minute.</div>
                </div>
              </details>
            </>
          ) : (
            <div style={help}>Your number is being set up. We&apos;ll email you the moment it&apos;s ready.</div>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div style={rowStyle}>
        <CalendarCheck size={18} color="var(--accent-light)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}><CalendarRow calendar={calendar} /></div>
      </div>

      {/* Transfer */}
      <div style={rowStyle}>
        <PhoneCall size={18} color="var(--accent-light)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={label}>Transfer live calls to</div>
          <div style={{ ...help, marginBottom: 8 }}>
            When a caller asks for a person or has an emergency, the AI connects them here. Use your cell or a line that rings you — <strong>not</strong> the business number you forward to us (it would loop straight back to the AI).
            {!transferPhone && fallbackTransfer ? ` Right now it uses your account phone, ${pretty(fallbackTransfer)}.` : ""}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={transfer} onChange={e => setTransfer(e.target.value)} placeholder="(555) 123-4567" inputMode="tel" aria-label="Transfer phone number"
              style={{ flex: "1 1 180px", maxWidth: 240, fontSize: 14, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-2)", background: "var(--bg)", color: "var(--text)" }} />
            <button onClick={saveTransfer} disabled={saving || !transfer.trim()}
              style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 16px", cursor: saving ? "wait" : "pointer", opacity: saving || !transfer.trim() ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {msg && <div role="status" style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</div>}
        </div>
      </div>

      {/* Alerts */}
      <div style={rowStyle}>
        <Bell size={18} color="var(--accent-light)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={label}>Lead alerts go to</div>
          <div style={help}>
            {[alertEmail, alertPhone ? pretty(alertPhone) : null].filter(Boolean).join("  ·  ") || "No contact on file"} — every new lead and urgent call, with a one-tap &ldquo;mark contacted&rdquo; link. To change where alerts go, <a href="/client/support" style={{ color: "var(--accent-light)", fontWeight: 600 }}>send us a request</a>.
          </div>
        </div>
      </div>
    </div>
  )
}
