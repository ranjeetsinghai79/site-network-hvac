import { ScrollTrigger } from "./gsap-init"
import type gsap from "gsap"

type Killable =
  | gsap.core.Tween
  | gsap.core.Timeline
  | ScrollTrigger
  | { kill: () => void }

export function createScope() {
  const items: Killable[] = []
  return {
    add<T extends Killable>(item: T): T {
      items.push(item)
      return item
    },
    kill() {
      // .revert() (not .kill()) — kill() stops a tween but leaves whatever inline
      // styles it already applied in place. Under React StrictMode's dev-only
      // double-invoke (mount → cleanup → mount), that leftover partial state from
      // the first (immediately-killed) instance corrupts the second instance's
      // .from() calculations, freezing elements at their pre-animation state
      // forever. revert() undoes the inline styles too, so the second mount
      // starts clean. ScrollTrigger has no revert() of its own — its kill()
      // already un-pins/cleans up correctly.
      for (const item of items) {
        try {
          if ("revert" in item && typeof item.revert === "function") item.revert()
          else item.kill()
        } catch {
          // ignore — item may already be killed
        }
      }
      items.length = 0
    },
  }
}

export type Scope = ReturnType<typeof createScope>
