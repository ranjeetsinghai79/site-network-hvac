"use client"

import { useEffect } from "react"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "./use-reduced-motion"

interface Options {
  y?: number
  delay?: number
  duration?: number
  start?: string
}

export function useEntranceReveal(
  ref: React.RefObject<HTMLElement | null>,
  options?: Options,
) {
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (reduced) {
      gsap.set(el, { opacity: 1, y: 0 })
      return
    }

    const scope = createScope()
    const tween = gsap.from(el, {
      opacity: 0,
      y: options?.y ?? 40,
      duration: options?.duration ?? 0.65,
      delay: options?.delay ?? 0,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: options?.start ?? "top 88%",
        once: true,
      },
    })
    scope.add(tween)
    if (tween.scrollTrigger) scope.add(tween.scrollTrigger)

    return () => scope.kill()
  }, [ref, reduced, options?.y, options?.delay, options?.duration, options?.start])
}
