import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    name: "NETWORK HVAC",
    tagline: "Mastering perfect climate control daily.",
    phone: "(209) 328-8132",
    phoneHref: "tel:+12093288132",
    email: "",
    address: "",
    city: "Manteca",
    serviceAreas: ["Manteca"],
    license: "",
    since: "",
    google_rating: "",
    review_count: "",
    emergency: false,
    theme: "clean",
    niche: "hvac",
  },

  services: [
    { icon: "thermometer", title: "AC Installation", desc: "High-efficiency central air systems installed flawlessly.", urgent: false },
    { icon: "flame", title: "Furnace Repair", desc: "Rapid diagnostics and lasting fixes for winter warmth.", urgent: false },
    { icon: "zap", title: "Ductless Mini-Splits", desc: "Targeted climate control without the need for ductwork.", urgent: false },
    { icon: "home", title: "Heat Pump Replacement", desc: "Energy-saving heat pump upgrades for year-round comfort.", urgent: false },
    { icon: "sparkles", title: "Duct Cleaning", desc: "Breathe easier with comprehensive duct sealing and sanitization.", urgent: false },
    { icon: "phone", title: "Smart Thermostats", desc: "Take control of your energy bills from anywhere.", urgent: false }
  ],

  testimonials: [],

  trustBadges: [
    "Licensed & Insured",
    "Locally Owned & Operated",
    "Upfront, Transparent Pricing",
    "Friendly, Professional Technicians"
  ],

  stats: [],

  reasons: [
    { icon: "map-pin", title: "Local to Manteca", desc: "We're based right here in Manteca, so help is always close by." },
    { icon: "phone", title: "Direct to the Business", desc: "Call or text us directly — no call centers, no middlemen." },
    { icon: "dollar-sign", title: "Upfront Pricing", desc: "Know the cost before any work begins. No surprises, no hidden fees." },
    { icon: "wrench", title: "All Systems Serviced", desc: "Installation, repair, and maintenance for heating and cooling systems." },
    { icon: "message-circle", title: "Tell Us the Problem", desc: "Start with your exact issue and we'll walk you through the next step." },
    { icon: "shield-check", title: "Licensed & Insured", desc: "Work with confidence knowing you're covered." }
  ],

  formServiceOptions: [
    "AC Installation",
    "Furnace Repair",
    "Ductless Mini-Splits",
    "Heat Pump Replacement",
    "Duct Cleaning",
    "Smart Thermostats"
  ]
}

export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
