"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion, useCounter } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

function StatItem({ value, label, suffix, decimals }: {
  value: number
  label: string
  suffix: string
  decimals: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useCounter(ref, { to: value, suffix, decimals, start: "top 92%" })

  return (
    <div style={{ textAlign: "center", padding: "0 1rem" }}>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
        fontWeight: 700,
        color: "var(--brand-accent)",
        lineHeight: 1,
        marginBottom: "0.4rem",
        letterSpacing: "-0.01em",
      }}>
        <span ref={ref}>
          {decimals > 0 ? value.toFixed(decimals) : value.toString()}
        </span>
      </div>
      <div style={{
        fontSize: "0.68rem",
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--brand-fg-muted)",
        fontFamily: "var(--font-body)",
      }}>
        {label}
      </div>
    </div>
  )
}

export function StatsStrip({ config }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)
  const reduced  = useReducedMotion()

  useEffect(() => {
    if (reduced || !stripRef.current) return
    const scope = createScope()

    const items = stripRef.current.querySelectorAll<HTMLElement>(".stat-item")
    if (items.length) {
      const t = gsap.from(items, {
        opacity: 0, y: 24, stagger: 0.1, duration: 0.6, ease: "power3.out",
        scrollTrigger: { trigger: stripRef.current, start: "top 90%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced])

  const stats = config.stats ?? [
    { value: 4.9, label: "Google Rating",      suffix: "★",   decimals: 1 },
    { value: 521, label: "Happy Clients",       suffix: "+",   decimals: 0 },
    { value: 9,   label: "Years in Tracy",      suffix: "+",   decimals: 0 },
    { value: 3,   label: "Avg Wait Time (min)", suffix: "",    decimals: 0 },
  ]

  return (
    <div
      ref={stripRef}
      style={{
        background: "var(--brand-bg-mid)",
        borderTop: "1px solid rgba(201,169,110,0.12)",
        borderBottom: "1px solid rgba(201,169,110,0.12)",
        padding: "2.5rem 2rem",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
          gap: "1rem",
          alignItems: "center",
        }}
        className="stats-inner"
      >
        {stats.map((stat, i) => (
          <div key={stat.label} className="stat-item" style={{ position: "relative" }}>
            {i < stats.length - 1 && (
              <div style={{
                position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
                height: "2.5rem", width: "1px",
                background: "rgba(201,169,110,0.18)",
              }} />
            )}
            <StatItem
              value={Number(stat.value)}
              label={stat.label}
              suffix={String(stat.suffix ?? "")}
              decimals={stat.decimals ?? 0}
            />
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .stats-inner { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
