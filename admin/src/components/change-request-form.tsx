"use client"

import { useState } from "react"
import { Send, CheckCircle } from "lucide-react"

export function ChangeRequestFormClient({
  leadId,
  email,
}: {
  leadId: string
  email: string
}) {
  const [msg,    setMsg]    = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [errTxt, setErrTxt] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!msg.trim()) return
    setStatus("sending")
    try {
      const res = await fetch("/api/client/change-request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leadId, email, message: msg.trim() }),
      })
      if (res.ok) {
        setStatus("done")
        setMsg("")
      } else {
        const d = await res.json()
        setErrTxt(d.error ?? "Failed to send")
        setStatus("error")
      }
    } catch (e: any) {
      setErrTxt(e.message)
      setStatus("error")
    }
  }

  if (status === "done") {
    return (
      <div
        style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          gap:            12,
          padding:        "24px 0",
          textAlign:      "center",
        }}
      >
        <CheckCircle size={28} color="var(--success)" />
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
          Request sent!
        </div>
        <p style={{ fontSize: 13, color: "var(--text-2)" }}>
          We'll get back to you within 24 hours.
        </p>
        <button
          onClick={() => setStatus("idle")}
          style={{
            fontSize:       12,
            color:          "var(--muted)",
            background:     "transparent",
            border:         "none",
            cursor:         "pointer",
            textDecoration: "underline",
          }}
        >
          Send another request
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit}>
      <textarea
        value={msg}
        onChange={e => setMsg(e.target.value)}
        placeholder="Describe what you'd like to change — text, colors, photos, sections, anything…"
        rows={4}
        style={{
          width:        "100%",
          background:   "var(--surface-2)",
          border:       "1px solid var(--border-2)",
          borderRadius: 8,
          color:        "var(--text)",
          padding:      "11px 13px",
          fontSize:     13,
          resize:       "vertical",
          outline:      "none",
          marginBottom: 12,
          lineHeight:   1.6,
        }}
      />

      {status === "error" && (
        <div
          style={{
            background:   "var(--error-dim)",
            border:       "1px solid rgba(239,68,68,0.3)",
            borderRadius: 7,
            padding:      "8px 12px",
            fontSize:     12,
            color:        "var(--error)",
            marginBottom: 12,
          }}
        >
          {errTxt}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "sending" || !msg.trim()}
        style={{
          display:        "flex",
          alignItems:     "center",
          gap:            7,
          background:
            status === "sending" || !msg.trim()
              ? "var(--border-2)"
              : "var(--accent)",
          color:          "#fff",
          border:         "none",
          borderRadius:   8,
          padding:        "10px 20px",
          fontWeight:     700,
          fontSize:       13,
          cursor:
            status === "sending" || !msg.trim() ? "not-allowed" : "pointer",
        }}
      >
        <Send size={13} />
        {status === "sending" ? "Sending…" : "Send Request"}
      </button>
    </form>
  )
}
