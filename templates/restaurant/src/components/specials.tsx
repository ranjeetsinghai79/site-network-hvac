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

// 3D card flip-down entrance — distinct from every other section
const cardFlip = {
  hidden: (i: number) => ({
    opacity: 0,
    y: 60,
    rotateX: 22,
    scale: 0.94,
  }),
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    transition: { duration: 0.75, ease: EASE, delay: i * 0.1 },
  }),
}

const cardStagger = {
  visible: { transition: { staggerChildren: 0.1 } },
}

const specials = [
  {
    day: "Wednesday",
    badge: "ALL DAY",
    title: "Biryani Day",
    price: "$9.99",
    note: "Takeout Only",
    hours: "11:30 AM – 9:00 PM",
    highlight: false,
    image: "https://static.wixstatic.com/media/97cecd_3a46c24b961744d8a815aa91291789b9~mv2.jpg",
    items: [
      "Guntur Chicken Biryani",
      "Gongura Chicken Biryani",
      "Ulavacharu Chicken Biryani",
      "Egg Roast Biryani",
      "Gongura & Ulavacharu Paneer Biryani",
      "Veg & Mix Veg Biryani",
    ],
  },
  {
    day: "Saturday",
    badge: "LUNCH BUFFET",
    title: "Grand Feast",
    price: "$17.99",
    note: "Dine-in Only",
    hours: "11:30 AM – 3:00 PM",
    highlight: true,
    image: "https://static.wixstatic.com/media/97cecd_f974c44188a34a3a9f3bdaf0cc77e2fe~mv2.jpg",
    items: [
      "Mixed Veg Pakora & Baby Corn Manchuria",
      "Chicken 65 & Chicken Tikka",
      "Kadai Paneer & Butter Chicken",
      "Biryani, Naan & Fresh Chaat",
      "Rava Kesari & Hot Tea",
    ],
  },
  {
    day: "Sunday",
    badge: "GRAND FEAST",
    title: "Sunday Buffet",
    price: "$17.99",
    note: "Dine-in Only",
    hours: "11:30 AM – 3:00 PM",
    highlight: false,
    image: "https://static.wixstatic.com/media/97cecd_23ca11e39c7148889430cf4da143ce32~mv2.jpg",
    items: [
      "Guntur Chicken Fry & Curry Leaf Chicken",
      "Gongura Paneer Biryani & Special Goat Pulav",
      "Butter Chicken & Methi Chicken",
      "Pani Puri, Mango Dal & Rasam",
      "Pineapple Kesari & Desserts",
    ],
  },
]

export default function Specials() {
  return (
    <section id="specials" className="py-24 px-6 bg-surface-800 relative overflow-hidden" style={{ perspective: "1200px" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" aria-hidden />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r from-transparent via-gold-500/20 to-transparent" aria-hidden />

      <div className="max-w-6xl mx-auto">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col items-center mb-16"
        >
          <motion.span variants={fadeUp} className="text-gold-500 text-xs tracking-[0.4em] uppercase font-body mb-4">
            Weekly Deals
          </motion.span>
          <div className="overflow-hidden">
            <motion.h2 variants={maskReveal} className="font-display text-4xl md:text-5xl text-cream text-center">
              Specials & Offers
            </motion.h2>
          </div>
          <motion.div variants={fadeUp} className="w-16 h-px bg-gold-500 mt-6" />
        </motion.div>

        <motion.div
          variants={cardStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          style={{ transformStyle: "preserve-3d" }}
        >
          {specials.map((s, i) => (
            <motion.div
              key={s.day}
              variants={cardFlip}
              custom={i}
              whileHover={{ y: -6, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className={`relative rounded-2xl border overflow-hidden transition-colors duration-300 ${
                s.highlight
                  ? "bg-gold-500/8 border-gold-500/50 ring-1 ring-gold-500/15"
                  : "bg-surface-700 border-panel hover:border-gold-500/30"
              }`}
            >
              {s.highlight && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gold-500 text-surface-900 text-xs font-semibold px-4 py-1 rounded-full tracking-wide whitespace-nowrap">
                  MOST POPULAR
                </div>
              )}

              <div className="relative h-44 w-full group overflow-hidden">
                <Image
                  src={s.image}
                  alt={`${s.day} ${s.title} at ${config.business.name}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-700/80 via-surface-700/20 to-transparent" />
              </div>

              <div className="p-8">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <span className="text-gold-500/60 text-xs tracking-widest font-body">{s.badge}</span>
                    <h3 className="font-display text-2xl text-cream mt-1">{s.day}</h3>
                    <p className="text-muted text-sm font-body mt-0.5">{s.title}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="font-display text-3xl text-gold-500">{s.price}</div>
                    <div className="text-muted text-xs font-body mt-0.5">{s.note}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-gold-500/60 text-xs font-body mb-5">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden>
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                  </svg>
                  {s.hours}
                </div>

                <ul className="space-y-2 mb-8">
                  {s.items.map((item) => (
                    <li key={item} className="text-cream/65 text-sm font-body flex items-start gap-2">
                      <span className="text-gold-500/70 mt-0.5 shrink-0">–</span>
                      {item}
                    </li>
                  ))}
                </ul>

                <a
                  href="https://www.clover.com/online-ordering/minervagrand-tracy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full inline-flex items-center justify-center py-3 rounded-full text-sm font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                    s.highlight
                      ? "bg-gold-500 hover:bg-gold-400 text-surface-900 hover:scale-105"
                      : "border border-gold-500/40 hover:border-gold-500 text-gold-500 hover:bg-gold-500/10"
                  }`}
                >
                  Order Now
                </a>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
