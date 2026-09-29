import { useCallback } from "react"
import { gsap } from "../lib/gsap-init"

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"

interface Options {
  duration?: number
  delay?: number
}

export function useScramble() {
  const scramble = useCallback(
    (el: HTMLElement | null, target: string, options?: Options) => {
      if (!el) return
      const duration = options?.duration ?? 1.0
      const delay = options?.delay ?? 0
      const obj = { t: 0 }
      gsap.to(obj, {
        t: 1,
        duration,
        delay,
        ease: "power2.inOut",
        onUpdate() {
          const progress = obj.t
          const reveal = Math.floor(progress * target.length)
          let output = target.slice(0, reveal)
          for (let i = reveal; i < target.length; i++) {
            output += target[i] === " "
              ? " "
              : CHARS[Math.floor(Math.random() * CHARS.length)]
          }
          el.textContent = output
        },
      })
    },
    [],
  )
  return { scramble }
}
