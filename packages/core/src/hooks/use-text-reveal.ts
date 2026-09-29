"use client"

import { useEffect } from "react"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "./use-reduced-motion"

interface Options {
  delay?: number
  stagger?: number
  start?: string
}

export function useTextReveal(
  ref: React.RefObject<HTMLElement | null>,
  options?: Options,
) {
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const words = el.querySelectorAll<HTMLElement>(".split-word")
    if (!words.length) return

    if (reduced) {
      gsap.set(words, { yPercent: 0, opacity: 1 })
      return
    }

    const scope = createScope()
    const tween = gsap.from(words, {
      yPercent: 110,
      opacity: 0,
      stagger: options?.stagger ?? 0.045,
      duration: 0.7,
      ease: "power3.out",
      delay: options?.delay ?? 0,
      scrollTrigger: {
        trigger: el,
        start: options?.start ?? "top 85%",
        once: true,
      },
    })
    scope.add(tween)
    if (tween.scrollTrigger) scope.add(tween.scrollTrigger)

    return () => scope.kill()
  }, [ref, reduced, options?.delay, options?.stagger, options?.start])
}
