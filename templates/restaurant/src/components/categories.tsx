"use client"

import { motion } from "framer-motion"

const EASE = [0.25, 0.46, 0.45, 0.94] as const

// Apple-style mask reveal: text slides up from behind clip
const maskReveal = {
  hidden: { y: "105%" },
  visible: { y: "0%", transition: { duration: 0.85, ease: EASE } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
}

const cardStagger = {
  visible: { transition: { staggerChildren: 0.07 } },
}

// Cards fan in with alternating tilt
const cardVariant = {
  hidden: (i: number) => ({
    opacity: 0,
    y: 70,
    scale: 0.94,
    rotate: i % 2 === 0 ? -1.5 : 1.5,
  }),
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotate: 0,
    transition: { duration: 0.65, ease: EASE },
  },
}

const scaleWidth = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.7, ease: EASE, delay: 0.15 } },
}

const items = [
  {
    name: "Biryanis",
    desc: "Fragrant basmati rice slow-cooked with spiced meat or vegetables. Served with raita or salan.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 0 1 0 3.182L18.16 19.82a2.25 2.25 0 0 1-3.182 0l-.293-.293a2.25 2.25 0 0 0-3.182 0l-.293.293a2.25 2.25 0 0 1-3.182 0L5.96 18.16a2.25 2.25 0 0 1 0-3.182L4.5 15.5" />
      </svg>
    ),
  },
  {
    name: "Curries",
    desc: "Rich, aromatic gravies crafted with traditional spice blends — chicken, lamb, paneer, or vegetable.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.379a48.474 48.474 0 0 0-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 0 1 3 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 0 1 6 13.12M12.265 3.11a.375.375 0 1 1-.53 0L12 2.845l.265.265Zm-3 0a.375.375 0 1 1-.53 0L9 2.845l.265.265Zm6 0a.375.375 0 1 1-.53 0L15 2.845l.265.265Z" />
      </svg>
    ),
  },
  {
    name: "Appetizers",
    desc: "Crispy, bold Indian starters — pakoras, manchuria, samosas. The perfect start to any meal.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
      </svg>
    ),
  },
  {
    name: "Dosa",
    desc: "Crispy South Indian crepes paired with sambar and chutneys. A timeless breakfast staple.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    ),
  },
  {
    name: "Beer & Wine",
    desc: "Curated beer and wine selection. Perfect pairings for bold Indian flavors — sports bar style.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L4.5 15h15l-4.591-4.591A2.25 2.25 0 0 1 14.25 8.818V3.104M9.75 3.104c.866.115 1.74.172 2.625.172S13.384 3.22 14.25 3.104M9.75 3.104 9 3m5.25.104L15 3M3 15h18M5.25 21h13.5" />
      </svg>
    ),
  },
  {
    name: "Desserts",
    desc: "Sweet finishes — Double Ka Meetha, Rava Kesari, Pineapple Halwa and more.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
  },
]

export default function Categories() {
  return (
    <section id="menu" className="py-24 px-6 bg-surface-800">
      <div className="max-w-6xl mx-auto">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col items-center mb-16"
        >
          <motion.span variants={fadeUp} className="text-gold-500 text-xs tracking-[0.4em] uppercase font-body mb-4">
            Explore Our Menu
          </motion.span>
          <div className="overflow-hidden">
            <motion.h2 variants={maskReveal} className="font-display text-4xl md:text-5xl text-cream text-center">
              What We Serve
            </motion.h2>
          </div>
          <div className="overflow-hidden mt-6">
            <motion.div variants={scaleWidth} className="w-16 h-px bg-gold-500 origin-left" />
          </div>
        </motion.div>

        <motion.div
          variants={cardStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {items.map((item, i) => (
            <motion.div
              key={item.name}
              variants={cardVariant}
              custom={i}
              whileHover={{ y: -6, scale: 1.025 }}
              transition={{ duration: 0.2 }}
              className="group p-8 bg-surface-700 border border-panel hover:border-gold-500/40 rounded-2xl transition-colors duration-300 cursor-default"
            >
              <div className="text-gold-500 mb-5 transition-transform duration-300 group-hover:scale-110 group-hover:text-gold-400 w-fit">
                {item.icon}
              </div>
              <h3 className="font-display text-xl text-cream mb-3">{item.name}</h3>
              <p className="text-muted text-sm leading-relaxed font-body">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: EASE, delay: 0.2 }}
          className="flex justify-center mt-12"
        >
          <a
            href="https://www.clover.com/online-ordering/minervagrand-tracy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-gold-500/40 hover:border-gold-500 text-gold-500 hover:text-gold-400 hover:bg-gold-500/10 font-medium px-8 py-3.5 rounded-full text-sm tracking-wide transition-all duration-200 cursor-pointer"
          >
            View Full Menu & Order
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden>
              <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  )
}
