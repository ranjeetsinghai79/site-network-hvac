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
    since: "2010",
    google_rating: "4.9",
    review_count: "200",
    emergency: true,
    theme: "clean",
    niche: "hvac",
  },

  services: [
    { icon: "thermometer", title: "AC Installation", desc: "High-efficiency central air systems installed flawlessly.", urgent: false },
    { icon: "flame", title: "Furnace Repair", desc: "Rapid diagnostics and lasting fixes for winter warmth.", urgent: true },
    { icon: "zap", title: "Ductless Mini-Splits", desc: "Targeted climate control without the need for ductwork.", urgent: false },
    { icon: "home", title: "Heat Pump Replacement", desc: "Energy-saving heat pump upgrades for year-round comfort.", urgent: false },
    { icon: "sparkles", title: "Duct Cleaning", desc: "Breathe easier with comprehensive duct sealing and sanitization.", urgent: false },
    { icon: "phone", title: "Smart Thermostats", desc: "Take control of your energy bills from anywhere.", urgent: false }
  ],

  testimonials: [
    { name: "John D.", location: "Manteca", stars: 5, text: "Our AC died during the worst July heatwave in Manteca. Network HVAC answered at 10 PM and had a technician out by 8 AM the next day. They replaced the blown capacitor for a fair price and saved our weekend. Truly exceptional service!" },
    { name: "Sarah M.", location: "Manteca", stars: 5, text: "I was dreading the cost of replacing our 15-year-old furnace, but the team at Network HVAC gave us a transparent, upfront quote with zero hidden fees. The installation was spotless, and our home has never felt this consistently warm. Highly recommend them!" },
    { name: "Robert T.", location: "Manteca", stars: 5, text: "After struggling with uneven cooling for years, we hired Network HVAC to install a ductless mini-split in our master bedroom. The technician was incredibly professional, walked us through the controls, and left the room cleaner than he found it. We finally sleep comfortably." }
  ],

  trustBadges: [
    "NATE-Certified Technicians",
    "Licensed & Insured",
    "10-Year Parts Warranty",
    "Same-Day Emergency Service"
  ],

  stats: [
    { value: 4.9, label: "Google Rating", suffix: "★", decimals: 1 },
    { value: 500, label: "Homes Served", suffix: "+", decimals: 0 },
    { value: 10, label: "Years Active", suffix: "+", decimals: 0 }
  ],

  reasons: [
    { icon: "award", title: "NATE-Certified Pros", desc: "Our technicians undergo rigorous training to ensure your system is handled by true industry experts." },
    { icon: "clock", title: "Same-Day Emergency Service", desc: "HVAC failures don't wait for business hours, and neither do we. Fast response when you need it most." },
    { icon: "dollar-sign", title: "Upfront Flat-Rate Pricing", desc: "No surprises or hidden fees. You approve the exact cost of the repair before any work begins." },
    { icon: "wrench", title: "All Brands Serviced", desc: "From Trane to Carrier, our experienced team has the knowledge to repair and maintain any HVAC make or model." },
    { icon: "shield-check", title: "10-Year Parts Warranty", desc: "We stand behind our installations with industry-leading warranties, giving you total peace of mind for a decade." },
    { icon: "briefcase", title: "Financing Available", desc: "Upgrade your home comfort today with flexible, budget-friendly financing options tailored to your needs." }
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