"use client"

import { useEffect } from "react"
import { gsap } from "../lib/gsap-init"
import { useReducedMotion } from "./use-reduced-motion"

interface Options {
  selector?: string
  maxRotY?: number
  maxRotX?: number
  zDepth?: number
}

export function useTilt(
  containerRef: React.RefObject<HTMLElement | null>,
  options?: Options,
) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const container = containerRef.current
    if (!container) return
    const selector = options?.selector ?? ".tilt-3d"
    const cards = Array.from(container.querySelectorAll<HTMLElement>(selector))
    if (!cards.length) return

    const maxRotY = options?.maxRotY ?? 14
    const maxRotX = options?.maxRotX ?? 10
    const zDepth = options?.zDepth ?? 20

    const cleanups = cards.map((card) => {
      const setRotX = gsap.quickTo(card, "rotationX", { duration: 0.4, ease: "power2.out" })
      const setRotY = gsap.quickTo(card, "rotationY", { duration: 0.4, ease: "power2.out" })
      const setZ = gsap.quickTo(card, "z", { duration: 0.3, ease: "power2.out" })

      gsap.set(card, { transformPerspective: 900, transformStyle: "preserve-3d" })

      const onMove = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width - 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5
        setRotY(x * maxRotY)
        setRotX(-y * maxRotX)
        setZ(zDepth)
        card.style.boxShadow = `
          ${-x * 12}px ${y * 12}px 40px -8px rgba(0,0,0,0.35),
          0 0 0 1px rgba(255,255,255,0.12)
        `
      }
      const onLeave = () => {
        setRotX(0)
        setRotY(0)
        setZ(0)
        card.style.boxShadow = ""
      }

      card.addEventListener("mousemove", onMove)
      card.addEventListener("mouseleave", onLeave)
      return () => {
        card.removeEventListener("mousemove", onMove)
        card.removeEventListener("mouseleave", onLeave)
      }
    })

    return () => cleanups.forEach((fn) => fn())
  }, [containerRef, reduced, options?.selector, options?.maxRotY, options?.maxRotX, options?.zDepth])
}
