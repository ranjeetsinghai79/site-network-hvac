"use client"

import { motion } from "framer-motion"
import Image from "next/image"

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

// Wide card: zoom-out reveal (Apple product reveal style)
const wideCardReveal = {
  hidden: { opacity: 0, scale: 1.05 },
  visible: { opacity: 1, scale: 1, transition: { duration: 1.0, ease: EASE } },
}

// Smaller cards slide in from opposite sides
const slideLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.75, ease: EASE } },
}

const slideRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.75, ease: EASE } },
}

const featured = [
  {
    image: "https://static.wixstatic.com/media/97cecd_3a46c24b961744d8a815aa91291789b9~mv2.jpg",
    category: "Every Wednesday",
    name: "Biryani Day",
    desc: "Six hand-crafted biryanis — Guntur Chicken, Gongura, Ulavacharu, Egg Roast, Paneer & Veg. Slow-cooked, fragrant, unforgettable.",
    price: "$9.99",
    tag: "All Day · Takeout",
    wide: true,
  },
  {
    image: "https://static.wixstatic.com/media/97cecd_d4b81afa59f54f0f814da4dde1104a8a~mv2.jpg",
    category: "Every Saturday",
    name: "Grand Lunch Buffet",
    desc: "Unlimited spread — Pakora, Chicken 65, Chicken Tikka, Kadai Paneer, Butter Chicken, Biryani, Naan & Rava Kesari. Dine-in only.",
    price: "$17.99",
    tag: "11:30 AM – 3:00 PM",
    wide: false,
  },
  {
    image: "https://static.wixstatic.com/media/97cecd_a58a675827ec48139dbc221e8d44d1f6~mv2.jpg",
    category: "Every Sunday",
    name: "Royal Sunday Feast",
    desc: "The grandest spread — Guntur Chicken Fry, Gongura Paneer Biryani, Goat Pulav, Pani Puri, Mango Dal & decadent desserts.",
    price: "$17.99",
    tag: "11:30 AM – 3:00 PM",
    wide: false,
  },
]

const highlights = [
  "Hyderabadi Dum Biryani",
  "Butter Chicken",
  "Gongura Chicken",
  "Chicken 65",
  "Masala Dosa",
  "Paneer Tikka",
  "Ulavacharu Chicken",
  "Curry Leaf Chicken",
  "Goat Pulav",
  "Pani Puri",
  "Double Ka Meetha",
  "Baby Corn Manchuria",
]

export default function Dishes() {
  return (
    <section className="py-24 px-6 bg-surface-900 relative overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent"
        aria-hidden
      />

      <div className="max-w-6xl mx-auto">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col items-center mb-16"
        >
          <motion.span
            variants={fadeUp}
            className="text-gold-500 text-xs tracking-[0.4em] uppercase font-body mb-4"
          >
            Chef&apos;s Selection
          </motion.span>
          <div className="overflow-hidden">
            <motion.h2 variants={maskReveal} className="font-display text-4xl md:text-5xl text-cream text-center">
              From Our Kitchen
            </motion.h2>
          </div>
          <motion.p
            variants={fadeUp}
            className="text-muted font-body text-center mt-4 max-w-xl leading-relaxed"
          >
            Every dish crafted from recipes passed through generations — bold Andhra spices, fragrant Hyderabadi dum, and the warmth of home cooking.
          </motion.p>
          <motion.div variants={fadeUp} className="w-16 h-px bg-gold-500 mt-6" />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Wide featured card — zoom-out reveal */}
          <motion.div
            variants={wideCardReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="group relative md:col-span-2 rounded-2xl overflow-hidden border border-panel hover:border-gold-500/40 transition-colors duration-300"
          >
            <div className="relative h-72 md:h-[420px]">
              <Image
                src={featured[0].image}
                alt={featured[0].name}
                fill
                sizes="100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-surface-900/90 via-surface-900/60 to-surface-900/10" />
              <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
                <span className="text-gold-500 text-xs tracking-widest uppercase font-body mb-2">
                  {featured[0].category}
                </span>
                <h3 className="font-display text-3xl md:text-5xl text-cream mb-3">
                  {featured[0].name}
                </h3>
                <p className="text-cream/70 font-body text-sm md:text-base max-w-lg leading-relaxed mb-6">
                  {featured[0].desc}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-display text-3xl text-gold-500">
                    {featured[0].price}
                  </span>
                  <span className="text-xs text-muted font-body border border-muted/30 px-3 py-1.5 rounded-full">
                    {featured[0].tag}
                  </span>
                  <a
                    href="https://www.clover.com/online-ordering/minervagrand-tracy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto bg-gold-500 hover:bg-gold-400 text-surface-900 font-semibold px-7 py-3 rounded-full text-sm tracking-wide transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                  >
                    Order Now
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Two smaller cards — slide from opposite sides */}
          {[
            { dish: featured[1], variant: slideLeft },
            { dish: featured[2], variant: slideRight },
          ].map(({ dish, variant }) => (
            <motion.div
              key={dish.name}
              variants={variant}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="group rounded-2xl overflow-hidden border border-panel hover:border-gold-500/40 transition-colors duration-300 flex flex-col"
            >
              <div className="relative h-56 md:h-64 shrink-0">
                <Image
                  src={dish.image}
                  alt={dish.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-700/60 via-transparent to-transparent" />
              </div>
              <div className="p-7 bg-surface-700 flex flex-col flex-1 border-t border-panel/60">
                <span className="text-gold-500/60 text-xs tracking-widest uppercase font-body mb-1">
                  {dish.category}
                </span>
                <h3 className="font-display text-2xl text-cream mb-2">{dish.name}</h3>
                <p className="text-muted font-body text-sm leading-relaxed flex-1 mb-5">
                  {dish.desc}
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-2xl text-gold-500">{dish.price}</div>
                    <div className="text-muted text-xs font-body mt-0.5">{dish.tag}</div>
                  </div>
                  <a
                    href="https://www.clover.com/online-ordering/minervagrand-tracy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-gold-500/40 hover:border-gold-500 text-gold-500 hover:bg-gold-500/10 font-medium px-5 py-2.5 rounded-full text-sm tracking-wide transition-all duration-200 cursor-pointer"
                  >
                    Order Now
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Dish highlights */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <p className="text-muted/50 text-xs tracking-widest uppercase font-body text-center mb-4">
            Also on our menu
          </p>
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {highlights.map((item, i) => (
              <motion.span
                key={item}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE, delay: i * 0.04 }}
                className="text-cream/60 text-xs font-body border border-panel hover:border-gold-500/30 hover:text-cream/80 px-4 py-2 rounded-full transition-colors duration-200 cursor-default"
              >
                {item}
              </motion.span>
            ))}
          </div>
          <div className="flex justify-center">
            <a
              href="/menu"
              className="text-gold-500 hover:text-gold-400 text-sm font-body tracking-wide transition-colors duration-200"
            >
              Browse all 200+ dishes →
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
