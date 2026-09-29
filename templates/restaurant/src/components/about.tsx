"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { config } from "@/lib/config"

const EASE = [0.25, 0.46, 0.45, 0.94] as const

const maskReveal = {
  hidden: { y: "105%" },
  visible: { y: "0%", transition: { duration: 0.85, ease: EASE } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 45 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
}

// Stats pop in with spring
const statPop = {
  hidden: { opacity: 0, scale: 0.7, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 22 },
  },
}

const statsStagger = {
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
}

const stats = [
  { value: "200+", label: "Authentic Dishes" },
  { value: "$9.99", label: "Wed Biryani Special" },
  { value: "$17.99", label: "Weekend Buffet" },
  { value: "Tracy, CA", label: "Bay Area Location" },
]

export default function About() {
  return (
    <section id="about" className="py-24 px-6 bg-surface-900 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Image — zoom-out reveal (Apple product photo style) */}
          <motion.div
            initial={{ opacity: 0, scale: 1.06 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 1.0, ease: EASE }}
            className="relative"
          >
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
              <Image
                src="https://static.wixstatic.com/media/11062b_d86a12c9f109497da61e9f9cb1d36970~mv2.jpg/v1/fill/w_860,h_645,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/11062b_d86a12c9f109497da61e9f9cb1d36970~mv2.jpg"
                alt={`${config.business.name} dining room and authentic Indian dishes`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-900/50 to-transparent" />
            </div>
            {/* Decorative frame — delayed entrance */}
            <motion.div
              initial={{ opacity: 0, x: 10, y: 10 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.4 }}
              className="absolute -bottom-4 -right-4 w-full h-full border border-gold-500/25 rounded-2xl -z-10"
            />
            <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-gold-500/5 rounded-full blur-2xl" />
          </motion.div>

          {/* Text block */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            <motion.span variants={fadeUp} className="text-gold-500 text-xs tracking-[0.4em] uppercase font-body">
              Our Story
            </motion.span>

            <div className="overflow-hidden mt-4 mb-6">
              <motion.h2 variants={maskReveal} className="font-display text-4xl md:text-5xl text-cream leading-tight">
                Crafted with Passion<br />& Tradition
              </motion.h2>
            </div>

            <motion.p variants={fadeUp} className="text-muted leading-relaxed mb-5 font-body">
              {config.business.name} was founded with a single passion: serving authentic Indian cuisine at honest prices. We bring the rich culinary heritage of India — fragrant Hyderabadi biryanis, bold Andhra curries, crispy South Indian dosas — right to the heart of Tracy, California.
            </motion.p>
            <motion.p variants={fadeUp} className="text-muted leading-relaxed mb-10 font-body">
              Beyond the food, we&apos;re a gathering place. Our sports bar pairs a curated selection of beer and wine with bold Indian flavors, making every visit an experience worth sharing.
            </motion.p>

            {/* Stats — spring pop-in */}
            <motion.div variants={statsStagger} className="grid grid-cols-2 gap-5">
              {stats.map((s) => (
                <motion.div
                  key={s.label}
                  variants={statPop}
                  className="border-l-2 border-gold-500/50 pl-4 py-1"
                >
                  <div className="font-display text-2xl text-gold-500">{s.value}</div>
                  <div className="text-muted text-sm font-body mt-1">{s.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
