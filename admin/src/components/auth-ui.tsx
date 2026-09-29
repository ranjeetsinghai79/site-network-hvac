import type { ReactNode } from "react"

/** Centered card used by every signed-out screen (sign in, forgot, reset, welcome). */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, margin: "0 auto 18px", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 20, fontFamily: "'Plus Jakarta Sans', sans-serif", background: "linear-gradient(135deg, #00C26F, #0EA5E9)" }}>W</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 14, color: "var(--muted)", margin: "8px 0 0", lineHeight: 1.55 }}>{subtitle}</p>}
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 28 }}>{children}</div>
        {footer && <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{footer}</div>}
      </div>
    </div>
  )
}
