"use client"

import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

// Register on both server (no-op) and client. Idempotent — safe to call repeatedly.
gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }
