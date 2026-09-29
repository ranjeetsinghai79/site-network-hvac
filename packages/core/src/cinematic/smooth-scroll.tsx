"use client"

import { useEffect } from "react"
import Lenis from "lenis"
import { ScrollTrigger } from "../lib/gsap-init"
import { setLenis } from "../lib/lenis-singleton"
import { useReducedMotion } from "../hooks/use-reduced-motion"

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return

    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true })
    setLenis(lenis)

    lenis.on("scroll", ScrollTrigger.update)

    let rafId = 0
    const raf = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    // Recalculate all trigger positions after layout settles
    ScrollTrigger.refresh()

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      setLenis(null)
    }
  }, [reduced])

  return <>{children}</>
}
