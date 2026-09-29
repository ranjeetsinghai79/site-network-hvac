"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "../lib/gsap-init"
import { useReducedMotion } from "../hooks/use-reduced-motion"

interface Props {
  /** Skip cursor entirely on touch devices (default true) */
  disableOnTouch?: boolean
}

export function MagneticCursor({ disableOnTouch = true }: Props) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (reduced) return
    if (disableOnTouch && window.matchMedia("(pointer: coarse)").matches) return
    setEnabled(true)
  }, [reduced, disableOnTouch])

  useEffect(() => {
    if (!enabled) return
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    document.documentElement.style.cursor = "none"

    const setXO = gsap.quickTo(outer, "x", { duration: 0.55, ease: "power2.out" })
    const setYO = gsap.quickTo(outer, "y", { duration: 0.55, ease: "power2.out" })
    const setXI = gsap.quickTo(inner, "x", { duration: 0.12, ease: "power2.out" })
    const setYI = gsap.quickTo(inner, "y", { duration: 0.12, ease: "power2.out" })

    let visible = false

    const onMove = (e: MouseEvent) => {
      if (!visible) {
        gsap.to([outer, inner], { opacity: 1, duration: 0.3 })
        visible = true
      }
      setXO(e.clientX); setYO(e.clientY)
      setXI(e.clientX); setYI(e.clientY)
    }

    const isInteractive = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      return !!(
        target.closest("a,button,[data-magnetic],input,textarea,select") ||
        target.tagName === "A" ||
        target.tagName === "BUTTON"
      )
    }

    const onEnter = (e: MouseEvent) => {
      if (isInteractive(e.target)) {
        gsap.to(outer, { scale: 2.2, borderColor: "var(--brand-accent)", duration: 0.3, ease: "power2.out" })
        gsap.to(inner, { scale: 0.4, duration: 0.3, ease: "power2.out" })
      }
    }
    const onLeave = (e: MouseEvent) => {
      if (isInteractive(e.target)) {
        gsap.to(outer, { scale: 1, borderColor: "rgba(255,255,255,0.5)", duration: 0.3, ease: "power2.out" })
        gsap.to(inner, { scale: 1, duration: 0.3, ease: "power2.out" })
      }
    }
    const onDown = () => gsap.to(outer, { scale: 0.8, duration: 0.15, ease: "power2.in" })
    const onUp = () => gsap.to(outer, { scale: 1, duration: 0.2, ease: "power2.out" })

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseover", onEnter)
    window.addEventListener("mouseout", onLeave)
    window.addEventListener("mousedown", onDown)
    window.addEventListener("mouseup", onUp)

    return () => {
      document.documentElement.style.cursor = ""
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseover", onEnter)
      window.removeEventListener("mouseout", onLeave)
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("mouseup", onUp)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <>
      <div
        ref={outerRef}
        className="fixed pointer-events-none z-[9999] opacity-0"
        style={{
          width: 36,
          height: 36,
          border: "1.5px solid rgba(255,255,255,0.5)",
          borderRadius: "50%",
          transform: "translate(-50%,-50%)",
          top: 0,
          left: 0,
          mixBlendMode: "difference",
        }}
        aria-hidden
      />
      <div
        ref={innerRef}
        className="fixed pointer-events-none z-[9999] opacity-0"
        style={{
          width: 6,
          height: 6,
          background: "white",
          borderRadius: "50%",
          transform: "translate(-50%,-50%)",
          top: 0,
          left: 0,
        }}
        aria-hidden
      />
    </>
  )
}
