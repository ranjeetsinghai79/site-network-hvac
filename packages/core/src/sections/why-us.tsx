"use client"

import { useEffect, useRef } from "react"
import { Award } from "lucide-react"
import type { SiteConfig } from "../types"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"
import { useTilt } from "../hooks/use-tilt"
import { useCounter } from "../hooks/use-counter"
import { getIcon } from "./icon-map"
import { SplitText } from "../effects/split-text"

interface Props {
  config: SiteConfig
  label?: string
  heading?: React.ReactNode
  paragraph?: string
}

function StatCounter({ value, label, decimals = 0, suffix = "" }: { value: number; label: string; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useCounter(ref, { to: value, decimals, suffix })
  return (
    <div className="text-center">
      <div
        className="font-display text-3xl tabular-nums"
        style={{ color: "var(--brand-accent)", fontWeight: 900 }}
      >
        <span ref={ref}>0{suffix}</span>
      </div>
      <div className="font-body text-xs text-white/65 mt-1">{label}</div>
    </div>
  )
}

export function WhyUs({ config, label = "Why Choose Us", heading, paragraph }: Props) {
  const business = config.business
  const reasons = config.reasons ?? []
  const stats = config.stats ?? []

  const leftRef = useRef<HTMLDivElement>(null)
  const reasonsRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useTilt(reasonsRef, { selector: ".reason-card" })

  useEffect(() => {
    if (reduced) {
      gsap.set([leftRef.current, ...(reasonsRef.current?.querySelectorAll(".reason-card") ?? [])].filter(Boolean), {
        opacity: 1, x: 0, y: 0, scale: 1,
      })
      return
    }

    const scope = createScope()

    const left = gsap.from(leftRef.current, {
      opacity: 0, x: -70, duration: 1.0, ease: "expo.out",
      scrollTrigger: { trigger: leftRef.current, start: "top 82%", once: true },
    })
    scope.add(left)
    if (left.scrollTrigger) scope.add(left.scrollTrigger)

    const cards = reasonsRef.current?.querySelectorAll<HTMLElement>(".reason-card")
    if (cards?.length) {
      const t = gsap.from(cards, {
        opacity: 0, y: 60, scale: 0.9, rotationY: 8, stagger: 0.1, duration: 0.85, ease: "expo.out",
        transformOrigin: "center bottom",
        scrollTrigger: { trigger: reasonsRef.current, start: "top 80%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced])

  if (!reasons.length && !stats.length) return null

  return (
    <section
      id="why-us"
      className="py-24 px-6"
      style={{ background: "var(--brand-bg-section)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div ref={leftRef}>
            <span className="section-label">{label}</span>
            <h2
              className="font-display text-white text-4xl md:text-5xl leading-tight mb-6"
              style={{ fontWeight: 800 }}
            >
              {heading ?? (
                <>
                  The {business.since} Difference —<br />
                  <SplitText className="text-gradient">Built on Trust</SplitText>
                </>
              )}
            </h2>
            {paragraph !== undefined && (
              <p className="font-body text-white/55 leading-relaxed mb-10 max-w-md">
                {paragraph ?? `Since ${business.since}, we've earned trust one job at a time. No upsells. No scare tactics. Just honest work.`}
              </p>
            )}
            {paragraph === undefined && (
              <p className="font-body text-white/55 leading-relaxed mb-10 max-w-md">
                Since {business.since}, we&apos;ve earned trust one job at a time. No upsells. No scare tactics. Just honest work.
              </p>
            )}

            {stats.length > 0 && (
              <div className="grid gap-6 mb-10" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
                {stats.map((s) => {
                  const num = typeof s.value === "number" ? s.value : parseFloat(String(s.value).replace(/[^\d.]/g, ""))
                  return (
                    <StatCounter
                      key={s.label}
                      value={isFinite(num) ? num : 0}
                      label={s.label}
                      decimals={s.decimals ?? 0}
                      suffix={s.suffix ?? ""}
                    />
                  )
                })}
              </div>
            )}

            {business.license && (
              <div className="flex items-center gap-4 p-5 rounded-2xl glass-dark">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "color-mix(in srgb, var(--brand-accent) 15%, transparent)", color: "var(--brand-accent)" }}
                >
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-display text-white text-sm" style={{ fontWeight: 700 }}>{business.license}</div>
                  <div className="font-body text-xs text-white/55 mt-0.5">Licensed · Fully Insured</div>
                </div>
              </div>
            )}
          </div>

          <div ref={reasonsRef} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {reasons.map((r) => (
              <div
                key={r.title}
                className="reason-card glass-dark p-5 rounded-xl cursor-default"
                style={{ transition: "border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease" }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  el.style.borderColor = "color-mix(in srgb, var(--brand-accent) 40%, transparent)"
                  el.style.boxShadow = "0 0 32px -8px color-mix(in srgb, var(--brand-accent) 22%, transparent)"
                  el.style.transform = "translateY(-3px)"
                  const icon = el.querySelector<HTMLElement>(".reason-icon")
                  if (icon) icon.style.transform = "scale(1.15)"
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  el.style.borderColor = ""
                  el.style.boxShadow = ""
                  el.style.transform = ""
                  const icon = el.querySelector<HTMLElement>(".reason-icon")
                  if (icon) icon.style.transform = ""
                }}
              >
                <div
                  className="reason-icon w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{
                    background: "color-mix(in srgb, var(--brand-accent) 12%, transparent)",
                    color: "var(--brand-accent)",
                    transition: "transform 0.25s ease",
                  }}
                >
                  {getIcon(r.icon, "w-5 h-5")}
                </div>
                <h3 className="font-display text-white text-base mb-2" style={{ fontWeight: 700 }}>{r.title}</h3>
                <p className="font-body text-white/55 text-sm leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
