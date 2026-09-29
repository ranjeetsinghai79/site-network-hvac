"use client"

import { useEffect } from "react"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "./use-reduced-motion"

interface Options {
  y?: number
  scale?: number
  stagger?: number
  delay?: number
  start?: string
}

export function useStaggerReveal(
  containerRef: React.RefObject<HTMLElement | null>,
  selector: string,
  options?: Options,
) {
  const reduced = useReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const els = container.querySelectorAll<HTMLElement>(selector)
    if (!els.length) return

    if (reduced) {
      gsap.set(els, { opacity: 1, y: 0, scale: 1 })
      return
    }

    const scope = createScope()
    const tween = gsap.from(els, {
      opacity: 0,
      y: options?.y ?? 48,
      scale: options?.scale ?? 0.95,
      stagger: options?.stagger ?? 0.07,
      duration: 0.65,
      delay: options?.delay ?? 0,
      ease: "power3.out",
      scrollTrigger: {
        trigger: container,
        start: options?.start ?? "top 85%",
        once: true,
      },
    })
    scope.add(tween)
    if (tween.scrollTrigger) scope.add(tween.scrollTrigger)

    return () => scope.kill()
  }, [containerRef, selector, reduced, options?.y, options?.scale, options?.stagger, options?.delay, options?.start])
}
