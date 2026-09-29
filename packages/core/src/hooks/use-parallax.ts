"use client"

import { useEffect } from "react"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "./use-reduced-motion"

interface Options {
  yPercent?: number
  scrub?: number | boolean
  start?: string
  end?: string
}

export function useParallax(
  ref: React.RefObject<HTMLElement | null>,
  triggerRef: React.RefObject<HTMLElement | null>,
  options?: Options,
) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    const trigger = triggerRef.current
    if (!el || !trigger) return

    const scope = createScope()
    const tween = gsap.to(el, {
      yPercent: options?.yPercent ?? -20,
      ease: "none",
      scrollTrigger: {
        trigger,
        start: options?.start ?? "top top",
        end: options?.end ?? "bottom top",
        scrub: options?.scrub ?? 1.5,
      },
    })
    scope.add(tween)
    if (tween.scrollTrigger) scope.add(tween.scrollTrigger)

    return () => scope.kill()
  }, [ref, triggerRef, reduced, options?.yPercent, options?.scrub, options?.start, options?.end])
}
