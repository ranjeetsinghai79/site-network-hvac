"use client"

import { useEffect, useRef, useState } from "react"
import { gsap, ScrollTrigger } from "../lib/gsap-init"
import { useReducedMotion } from "../hooks/use-reduced-motion"

interface Props {
  name: string
  tagline?: string
  /** Minimum time the loader stays visible (ms). Default 600 — prevents flash on cached loads. */
  minDisplayMs?: number
}

export function LoadingScreen({ name, tagline, minDisplayMs = 600 }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLDivElement>(null)
  const tagRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const [done, setDone] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) {
      setDone(true)
      return
    }

    document.body.style.overflow = "hidden"
    const startedAt = performance.now()

    const tl = gsap.timeline({
      onComplete: () => {
        const elapsed = performance.now() - startedAt
        const wait = Math.max(0, minDisplayMs - elapsed)
        setTimeout(() => {
          document.body.style.overflow = ""
          // Recalculate all ScrollTrigger positions after overlay exits
          ScrollTrigger.refresh()
          setDone(true)
        }, wait)
      },
    })

    tl.from(lineRef.current,    { scaleX: 0, duration: 0.55, ease: "power3.out", transformOrigin: "left" })
      .from(nameRef.current,    { opacity: 0, y: 16, duration: 0.55, ease: "power3.out" }, "-=0.2")
      .from(tagRef.current,     { opacity: 0, y: 8, duration: 0.4, ease: "power2.out" }, "-=0.3")
      .to(barRef.current,       { width: "100%", duration: 1.1, ease: "power2.inOut" }, "-=0.1")
      .to(overlayRef.current,   { yPercent: -100, duration: 0.8, ease: "power4.inOut", delay: 0.12 })

    return () => {
      tl.kill()
      document.body.style.overflow = ""
    }
  }, [reduced, minDisplayMs])

  if (done) return null

  return (
    <div
      ref={overlayRef}
      className="loading-screen fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(160deg, var(--brand-bg) 0%, var(--brand-bg-mid) 100%)",
      }}
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full aurora-blob pointer-events-none"
        style={{ background: "var(--brand-blob-1)", filter: "blur(80px)" }}
        aria-hidden
      />

      <div className="relative z-10 text-center">
        <div
          ref={lineRef}
          className="w-12 h-px mb-8 mx-auto"
          style={{ background: "var(--brand-accent)" }}
        />

        <div
          ref={nameRef}
          className="font-display text-white mb-2"
          style={{ fontSize: "clamp(1.75rem, 5vw, 3rem)", letterSpacing: "-0.02em", fontWeight: 700 }}
        >
          {name}
        </div>

        {tagline && (
          <div
            ref={tagRef}
            className="font-body mb-10"
            style={{
              color: "var(--brand-accent-light, var(--brand-accent))",
              fontSize: "0.7rem",
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {tagline}
          </div>
        )}

        <div
          className="w-32 h-px mx-auto"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          <div
            ref={barRef}
            className="h-full"
            style={{
              width: "0%",
              background: "linear-gradient(90deg, var(--brand-accent), var(--brand-accent-light, var(--brand-accent)))",
              boxShadow: "0 0 12px var(--brand-accent-glow, rgba(255,255,255,0.3))",
            }}
          />
        </div>
      </div>
    </div>
  )
}
