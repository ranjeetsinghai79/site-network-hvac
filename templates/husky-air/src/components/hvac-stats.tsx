"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@core/web"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

export default function HvacStats({ config }: Props) {
  const stats   = config.stats ?? []
  const rowRef  = useRef<HTMLDivElement>(null)
  const numRefs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    if (!rowRef.current) return

    const targets = numRefs.current.filter(Boolean)
    const proxies = stats.map(s => ({ val: 0 }))

    gsap.from(rowRef.current.querySelectorAll(".stat-item"), {
      opacity: 0, y: 28, scale: 0.92,
      stagger: 0.1, duration: 0.65, ease: "power3.out",
      immediateRender: false,
      scrollTrigger: { trigger: rowRef.current, start: "top 85%", once: true },
    })

    targets.forEach((el, i) => {
      const stat = stats[i]
      if (!el || !stat) return
      const numVal = typeof stat.value === "number" ? stat.value : parseFloat(String(stat.value))
      const dec    = stat.decimals ?? 0
      const suffix = stat.suffix ?? ""

      gsap.to(proxies[i], {
        val: numVal,
        duration: 1.8,
        delay: i * 0.1 + 0.3,
        ease: "power2.out",
        scrollTrigger: { trigger: rowRef.current, start: "top 85%", once: true },
        onUpdate() {
          if (el) {
            el.textContent = proxies[i].val.toFixed(dec) + suffix
          }
        },
        onComplete() {
          // pulse on complete
          const wrap = el?.closest<HTMLElement>(".stat-item")
          if (wrap) {
            gsap.fromTo(wrap, { scale: 1 }, { scale: 1.04, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" })
          }
        },
      })
    })
  }, [stats])

  return (
    <div
      className="relative py-0"
      style={{
        background: "var(--brand-bg)",
        borderTop:    "1px solid rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.03) 50%, transparent)",
        }}
      />
      <div ref={rowRef} className="relative max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16">
        <div className="flex items-stretch divide-x"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          {stats.map((stat, i) => {
            const numVal = typeof stat.value === "number" ? stat.value : parseFloat(String(stat.value))
            const suffix = stat.suffix ?? ""
            const dec    = stat.decimals ?? 0

            return (
              <div
                key={i}
                className="stat-item flex-1 flex flex-col items-center justify-center py-10 px-6 text-center"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                <div
                  className="font-display tabular-nums"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "clamp(2.2rem, 4vw, 3.5rem)",
                    lineHeight: 1,
                    color: "var(--brand-accent)",
                    textShadow: "0 0 30px rgba(249,115,22,0.4)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  <span
                    ref={el => { numRefs.current[i] = el }}
                  >
                    {numVal.toFixed(dec)}{suffix}
                  </span>
                </div>
                <p
                  className="mt-2 text-xs uppercase tracking-widest"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    color: "var(--brand-fg-muted)",
                    letterSpacing: "0.18em",
                  }}
                >
                  {stat.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
