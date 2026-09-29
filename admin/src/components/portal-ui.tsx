import type { ReactNode } from "react"

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", margin: 0, lineHeight: 1.15 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 14, color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({ title, aside, children, pad = true, style }: { title?: string; aside?: ReactNode; children: ReactNode; pad?: boolean; style?: React.CSSProperties }) {
  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 20, overflow: "hidden", ...style }}>
      {title && (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 22px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>{title}</h2>
          {aside}
        </header>
      )}
      <div style={pad ? { padding: "18px 22px" } : undefined}>{children}</div>
    </section>
  )
}

export function Kpi({ label, value, hint, tone = "default", href }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "good" | "warn"; href?: string }) {
  const color = tone === "good" ? "#047857" : tone === "warn" ? "#B45309" : "var(--text)"
  const inner = (
    <div style={{ background: "var(--surface)", border: `1px solid ${tone === "warn" ? "rgba(245,158,11,0.5)" : "var(--border)"}`, borderRadius: 14, padding: "18px 20px", height: "100%" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color, lineHeight: 1 }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{hint}</div>}
    </div>
  )
  return href ? <a href={href} style={{ textDecoration: "none", display: "block" }}>{inner}</a> : inner
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>{children}</div>
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "info" }) {
  const map = {
    neutral: ["var(--text-2)", "var(--surface-2)"], good: ["#047857", "rgba(16,185,129,0.12)"], warn: ["#B45309", "rgba(245,158,11,0.14)"],
    bad: ["#B91C1C", "rgba(220,38,38,0.1)"], info: ["#0369A1", "rgba(14,165,233,0.12)"],
  }[tone]
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", color: map[0], background: map[1], borderRadius: 5, padding: "3px 7px", whiteSpace: "nowrap", textTransform: "uppercase" }}>{children}</span>
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "36px 20px" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 380, margin: "0 auto", lineHeight: 1.55 }}>{body}</div>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

export function ButtonLink({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <a href={href} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, textDecoration: "none", borderRadius: 8, padding: "9px 16px",
      color: primary ? "#fff" : "var(--text-2)", background: primary ? "var(--accent)" : "var(--bg)", border: primary ? "none" : "1px solid var(--border-2)" }}>{children}</a>
  )
}
