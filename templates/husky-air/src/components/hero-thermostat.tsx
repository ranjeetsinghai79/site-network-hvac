"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@core/web"

// Arc: 270° sweep, bottom-left → top → bottom-right (clockwise through top)
// Center (200, 200), radius 150, from 225° to 315° (going clockwise, 270°)
// Start: 200 + 150*cos(225°) = 200 - 106.07 = 93.93 ≈ 94, 200 + 150*sin(225°) = 200 + 106.07 ≈ 306
// End:   200 + 150*cos(315°) = 200 + 106.07 ≈ 306, 200 + 150*sin(315°) = 200 - 106.07 ≈ 94
const ARC_START = { x: 94,  y: 306 }
const ARC_END   = { x: 306, y: 306 }
const ARC_R     = 150
// pathLength="100" on the arc — we animate strokeDashoffset from (100-88)=12 to (100-44)=56
// hot (94°F) = dasharray "88 12", cold (72°F) = dasharray "44 56"

// Tick marks: 13 ticks evenly spaced over 270°, starting at 225°
const TICKS = Array.from({ length: 13 }, (_, i) => {
  const angle = (225 + i * (270 / 12)) * (Math.PI / 180)
  const inner = 128
  const outer = 142
  return {
    x1: 200 + inner * Math.cos(angle),
    y1: 200 + inner * Math.sin(angle),
    x2: 200 + outer * Math.cos(angle),
    y2: 200 + outer * Math.sin(angle),
    major: i % 3 === 0,
  }
})

// Dial needle: starts at hot angle (225°+0%), ends at cold (225°+50%)
function needleAngle(pct: number) {
  return 225 + pct * 270 // degrees
}

export default function HeroThermostat() {
  const tempRef    = useRef<SVGTextElement>(null)
  const arcRef     = useRef<SVGPathElement>(null)
  const needleRef  = useRef<SVGLineElement>(null)
  const glowRef    = useRef<SVGCircleElement>(null)
  const ringRef    = useRef<SVGCircleElement>(null)
  const labelRef   = useRef<SVGTextElement>(null)

  useEffect(() => {
    const arc    = arcRef.current
    const temp   = tempRef.current
    const needle = needleRef.current
    const glow   = glowRef.current
    const ring   = ringRef.current

    if (!arc || !temp || !needle || !glow || !ring) return

    // proxy object for GSAP to tween
    const state = { pct: 0, deg: 94 }

    // Color interpolation: orange (#f97316) → blue (#60a5fa)
    const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
    function arcColor(pct: number) {
      const r = lerp(0xf9, 0x60, pct)
      const g = lerp(0x73, 0xa5, pct)
      const b = lerp(0x16, 0xfa, pct)
      return `rgb(${r},${g},${b})`
    }

    // Set initial state (hot)
    arc.style.stroke = arcColor(0)
    arc.setAttribute("stroke-dasharray", "88 12")
    arc.setAttribute("stroke-dashoffset", "0")
    glow.style.fill = arcColor(0)

    const angle0 = needleAngle(0)
    gsap.set(needle, { rotation: angle0, transformOrigin: "200px 200px" })

    // entrance: fade up + scale
    gsap.from([ringRef.current, arc, needle, temp, glow], {
      opacity: 0, scale: 0.85, duration: 1, ease: "power3.out", delay: 0.6,
      transformOrigin: "200px 200px",
      stagger: 0.06,
    })

    // main tween: 94°F → 72°F over 2.8s, starting after entrance
    const tween = gsap.to(state, {
      pct: 0.5,
      deg: 72,
      duration: 2.8,
      delay: 1.2,
      ease: "power2.inOut",
      onUpdate() {
        const { pct, deg } = state
        const col = arcColor(pct)

        // arc fill: from offset 12 (88 filled) → offset 56 (44 filled)
        // dasharray stays "88 12" — we reduce the filled portion via strokeDashoffset on a second approach:
        // simpler: animate stroke-dasharray directly
        const filled = 88 - pct * 44  // 88 → 44
        const gap    = 100 - filled
        arc.setAttribute("stroke-dasharray", `${filled.toFixed(2)} ${gap.toFixed(2)}`)
        arc.style.stroke  = col
        glow.style.fill   = col

        // temperature text
        temp.textContent = `${Math.round(deg)}°`

        // needle rotation
        const ang = needleAngle(pct)
        gsap.set(needle, { rotation: ang, transformOrigin: "200px 200px" })
      },
    })

    // after settling: gentle idle pulse on the glow + needle shimmer
    tween.then(() => {
      gsap.to(glow, {
        opacity: 0.3,
        scale: 1.15,
        repeat: -1,
        yoyo: true,
        duration: 2,
        ease: "sine.inOut",
        transformOrigin: "200px 200px",
      })
      // tiny needle wobble ±1.5°
      gsap.to(needle, {
        rotation: needleAngle(0.5) + 1.5,
        repeat: -1,
        yoyo: true,
        duration: 3,
        ease: "sine.inOut",
        transformOrigin: "200px 200px",
      })
    })

    return () => { tween.kill(); gsap.killTweensOf([glow, needle, state]) }
  }, [])

  return (
    <div className="relative flex items-center gap-5 select-none pointer-events-none">
      {/* Left: stat chips */}
      <div className="flex flex-col gap-2.5 shrink-0">
        {[
          { label: "Indoor", value: "94°F", sub: "Too Hot",   dot: "var(--brand-accent)" },
          { label: "Target", value: "72°F", sub: "Cooling",   dot: "var(--brand-accent-light)" },
          { label: "Efficiency", value: "SEER 21", sub: "High Efficiency", dot: "rgba(255,255,255,0.3)" },
        ].map(({ label, value, sub, dot }) => (
          <div
            key={label}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "0 4px 16px -4px rgba(0,0,0,0.4)",
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
            <div>
              <p className="text-[9px] text-white/30 font-body uppercase tracking-[0.15em] leading-none mb-0.5">{label}</p>
              <p className="text-sm font-display font-700 text-white leading-none">{value}</p>
              <p className="text-[9px] text-white/40 font-body leading-none mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Right: thermostat */}
      <div className="relative">
      {/* ambient outer ring glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(ellipse at center, color-mix(in srgb,var(--brand-accent) 18%, transparent) 0%, transparent 70%)",
          filter: "blur(32px)",
        }}
      />

      <svg
        viewBox="0 0 400 400"
        width="360"
        height="360"
        className="relative z-10 drop-shadow-2xl"
        aria-label="HVAC thermostat showing temperature drop from 94°F to 72°F"
      >
        <defs>
          {/* radial gradient for face */}
          <radialGradient id="faceBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#1e2a45" />
            <stop offset="100%" stopColor="#0d1625" />
          </radialGradient>
          {/* glow filter */}
          <filter id="arcGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="textGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* soft inner shadow */}
          <filter id="innerShadow" x="-5%" y="-5%" width="110%" height="110%">
            <feOffset dx="0" dy="2" />
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Outer bezel ── */}
        <circle cx="200" cy="200" r="185" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <circle cx="200" cy="200" r="178" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />

        {/* ── Face ── */}
        <circle ref={ringRef} cx="200" cy="200" r="168" fill="url(#faceBg)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

        {/* ── Track arc (background) ── */}
        <path
          d={`M ${ARC_START.x} ${ARC_START.y} A ${ARC_R} ${ARC_R} 0 1 1 ${ARC_END.x} ${ARC_END.y}`}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="12"
          strokeLinecap="round"
          pathLength="100"
        />

        {/* ── Tick marks ── */}
        {TICKS.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.major ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)"}
            strokeWidth={t.major ? 1.5 : 0.8}
            strokeLinecap="round"
          />
        ))}

        {/* ── Filled arc (animates) ── */}
        <path
          ref={arcRef}
          d={`M ${ARC_START.x} ${ARC_START.y} A ${ARC_R} ${ARC_R} 0 1 1 ${ARC_END.x} ${ARC_END.y}`}
          fill="none"
          stroke="#f97316"
          strokeWidth="12"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray="88 12"
          filter="url(#arcGlow)"
        />

        {/* ── Glow dot at needle tip ── */}
        {/* Positioned at cold end (50% = 315° on the arc) — GSAP will update via inline style */}
        <circle
          ref={glowRef}
          cx={ARC_END.x}
          cy={ARC_END.y}
          r="10"
          fill="#f97316"
          opacity="0.65"
          filter="url(#arcGlow)"
        />

        {/* ── Needle pivot center dot ── */}
        <circle cx="200" cy="200" r="4" fill="rgba(255,255,255,0.15)" />

        {/* ── Needle ── */}
        <line
          ref={needleRef}
          x1="200" y1="200"
          x2="200" y2="60"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="200" cy="200" r="8" fill="#1e2a45" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <circle cx="200" cy="200" r="3" fill="rgba(255,255,255,0.5)" />

        {/* ── Temperature display ── */}
        <text
          ref={tempRef}
          x="200" y="195"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="72"
          fontWeight="700"
          fontFamily="var(--font-display, system-ui)"
          fill="white"
          filter="url(#textGlow)"
          letterSpacing="-3"
        >
          94°
        </text>

        {/* ── "COOLING" label animates in after settle ── */}
        <text
          ref={labelRef}
          x="200" y="248"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fontWeight="600"
          fontFamily="var(--font-body, system-ui)"
          fill="rgba(255,255,255,0.35)"
          letterSpacing="4"
        >
          COOLING
        </text>

        {/* ── Scale labels ── */}
        <text x="72" y="325" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.25)" fontFamily="var(--font-body, system-ui)">60°</text>
        <text x="328" y="325" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.25)" fontFamily="var(--font-body, system-ui)">100°</text>
        <text x="200" y="64" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.25)" fontFamily="var(--font-body, system-ui)">80°</text>

        {/* ── Mode pills ── */}
        <rect x="148" y="275" width="104" height="22" rx="11" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <text x="200" y="286" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="600" fill="rgba(255,255,255,0.4)" letterSpacing="2" fontFamily="var(--font-body, system-ui)">AUTO · FAN · ECO</text>
      </svg>
      </div>{/* end thermostat right column */}
    </div>
  )
}
