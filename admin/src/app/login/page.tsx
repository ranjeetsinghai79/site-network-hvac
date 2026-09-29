"use client"

import { useState, FormEvent } from "react"
import { Zap, Lock, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [password, setPassword] = useState("")
  const [show,     setShow]     = useState(false)
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password }),
      })
      if (res.ok) {
        const params = new URLSearchParams(window.location.search)
        window.location.href = params.get("from") ?? "/"
      } else {
        const d = await res.json()
        setError(d.error ?? "Wrong password")
      }
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight:       "100vh",
        background:      "#0a0a12",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        fontFamily:      "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width:        360,
          background:   "#111118",
          border:       "1px solid rgba(99,102,241,0.2)",
          borderRadius: 16,
          padding:      "36px 32px",
          boxShadow:    "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div
            style={{
              width:          40,
              height:         40,
              borderRadius:   11,
              background:     "rgba(99,102,241,0.15)",
              border:         "1px solid rgba(99,102,241,0.3)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
            }}
          >
            <Zap size={18} color="#818cf8" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#e2e8f0", letterSpacing: "-0.02em" }}>
              WebsiteDeveloper
            </div>
            <div style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>Admin Console</div>
          </div>
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, color: "#e2e8f0", marginBottom: 6, letterSpacing: "-0.03em" }}>
          Sign in
        </div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 24 }}>
          Enter your admin password to continue
        </div>

        <form onSubmit={submit}>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <Lock
              size={14}
              color="#475569"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin password"
              autoFocus
              required
              style={{
                width:        "100%",
                background:   "#1a1a2e",
                border:       `1px solid ${error ? "#ef4444" : "rgba(99,102,241,0.2)"}`,
                borderRadius: 9,
                color:        "#e2e8f0",
                padding:      "11px 40px 11px 36px",
                fontSize:     14,
                outline:      "none",
                boxSizing:    "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              style={{
                position:   "absolute",
                right:      10,
                top:        "50%",
                transform:  "translateY(-50%)",
                background: "none",
                border:     "none",
                cursor:     "pointer",
                color:      "#475569",
                display:    "flex",
                padding:    4,
              }}
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width:        "100%",
              background:   loading || !password ? "#1e1e35" : "#6366f1",
              color:        loading || !password ? "#475569" : "#fff",
              border:       "none",
              borderRadius: 9,
              padding:      "12px",
              fontSize:     14,
              fontWeight:   700,
              cursor:       loading || !password ? "not-allowed" : "pointer",
              transition:   "background 0.12s",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}
