"use client"

import { useState, type FormEvent } from "react"
import { Check, Copy } from "lucide-react"

interface Props {
  snippet: string
  currentOrigin: string | null
}

export function WidgetSnippetCard({ snippet, currentOrigin }: Props) {
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState(currentOrigin ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard blocked — the code is still selectable in the <pre> below
    }
  }

  async function saveOrigin(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const res = await fetch("/api/client/widget-origin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not save that address.")
      setSaved(data.origin)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "22px 28px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Embed code</div>
        <button
          onClick={copy}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-2)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", fontSize: 12, overflowX: "auto", color: "var(--text-2)", margin: 0 }}>
        <code>{snippet}</code>
      </pre>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, lineHeight: 1.6 }}>
        Paste this once anywhere in your site&apos;s HTML — most site builders have a spot for &quot;custom code&quot; or &quot;header/footer scripts.&quot; No plugin, no rebuild, no downtime.
      </div>

      <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Where will you add it?</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5 }}>
          For security, the assistant only answers on the site you tell us about.{currentOrigin ? ` Currently set to ${currentOrigin}.` : " Set your website address below before embedding it."}
        </div>
        <form onSubmit={saveOrigin} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={origin}
            onChange={e => setOrigin(e.target.value)}
            placeholder="https://yourbusiness.com"
            style={{ flex: "1 1 220px", height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}
          />
          <button
            disabled={saving}
            style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "wait" : "pointer" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
        {saved && <div style={{ fontSize: 12, color: "#047857", marginTop: 8 }}>Saved — the assistant now answers on {saved}.</div>}
        {error && <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  )
}
