import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    name: "Coolridge Air",
    tagline: "Fast. Licensed. Trusted.",
    phone: "(555) 123-4567",
    phoneHref: "tel:+15551234567",
    email: "hello@coolridgeair.com",
    address: "Tracy, California",
    city: "Tracy",
    serviceAreas: ["Tracy", "Stockton", "Modesto", "Manteca", "Lathrop", "Lodi"],
    license: "CSLB #987654",
    since: "2008",
    google_rating: "4.9",
    review_count: "312",
    emergency: true,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      facebook: "https://facebook.com",
    },
    theme: "clean",
    niche: "hvac",
  },

  about: {
    heading: "Honest HVAC & Plumbing — Done Right the First Time",
    body: "Since 2008, Coolridge Air has been the call neighbors make when something breaks. No upsells. No scare tactics. Just NATE-certified technicians who show up on time, quote upfront, and fix it right — today. Over 4,800 jobs completed across Tracy and the Central Valley.",
    highlights: [
      { icon: "clock",        text: "Same-day service — call before noon and we're there today" },
      { icon: "dollar-sign",  text: "Upfront pricing — you approve the quote before any work starts" },
      { icon: "shield-check", text: "NATE certified technicians, fully licensed & insured (CSLB #987654)" },
    ],
  },

  services: [
    { icon: "thermometer",  image: "/service-1.jpg", title: "AC Repair & Install",    desc: "Same-day diagnostics and repair for all major AC brands — Carrier, Trane, Lennox, Goodman. New system installations backed by a 10-year parts warranty.", urgent: false },
    { icon: "flame",        image: "/service-2.jpg", title: "Heating & Furnace",      desc: "Furnace repair, replacement, and seasonal maintenance. No heat tonight? We have emergency slots open 24 hours a day — call now.", urgent: false },
    { icon: "droplets",     image: "/service-3.jpg", title: "Plumbing Repairs",       desc: "Leaks, clogs, burst pipes, water heaters, and full re-pipe. Residential and light commercial. We arrive stocked to fix it in one visit.", urgent: false },
    { icon: "zap",          image: "/service-4.jpg", title: "Emergency Service",      desc: "24/7 emergency dispatch with an average 45-minute response time across Tracy, Stockton, and Modesto. We answer every call — no voicemail.", urgent: true },
    { icon: "shield-check", image: "/service-5.jpg", title: "Maintenance Plans",      desc: "Annual tune-up plans that extend equipment life by 5+ years and cut energy bills by up to 20%. Priority scheduling included at no extra cost.", urgent: false },
    { icon: "wrench",       image: "/service-6.jpg", title: "Commercial HVAC",        desc: "Full commercial HVAC services for restaurants, offices, and retail spaces. Scheduled maintenance contracts and emergency response — same team, same accountability.", urgent: false },
  ],

  testimonials: [
    { name: "Maria S.", location: "Tracy, CA",    stars: 5, avatar: "https://i.pravatar.cc/80?u=maria_tracy_hvac",    text: "AC went out on a 104° day. Coolridge Air arrived in under an hour, had parts on the truck, done by noon. Saved us." },
    { name: "James T.", location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=james_stockton_hvac", text: "Called at 11pm for a burst pipe. Technician showed up in 40 minutes. Professional, clean, fair price. 5 stars." },
    { name: "Linda K.", location: "Manteca, CA",  stars: 5, avatar: "https://i.pravatar.cc/80?u=linda_manteca_hvac",  text: "Used them for annual furnace tune-up. Saved $340 vs competitor quote. Will use every year going forward." },
  ],

  trustBadges: [
    "Licensed & Insured",
    "NATE Certified",
    "BBB A+ Rated",
    "24/7 Emergency",
    "Free Estimates",
    "100% Satisfaction Guarantee",
  ],

  stats: [
    { value: 4.9,   label: "Google Rating",   suffix: "★", decimals: 1 },
    { value: 4800,  label: "Jobs Completed",  suffix: "+", decimals: 0 },
    { value: 16,    label: "Years in Business", suffix: "+", decimals: 0 },
    { value: 45,    label: "Min Avg Response", suffix: "m", decimals: 0 },
  ],

  reasons: [
    { icon: "clock",        title: "Same-Day Service",        desc: "Call before noon and we're there today. 45-minute average emergency response." },
    { icon: "dollar-sign",  title: "Upfront Pricing",         desc: "No surprises. We quote before we work, and we stick to it. Always." },
    { icon: "award",        title: "NATE Certified Techs",    desc: "Our technicians hold the highest HVAC certification available. Real expertise on every job." },
    { icon: "thumbs-up",    title: "Satisfaction Guarantee",  desc: "If you're not 100% satisfied, we come back and make it right. No questions." },
    { icon: "phone",        title: "We Answer the Phone",     desc: "No hold music, no voicemail maze. Call and talk to a real person about what's going on." },
    { icon: "truck",        title: "Stocked Service Trucks",  desc: "90% of repairs done on the first visit. We carry the parts so you're not waiting." },
    { icon: "users",        title: "Local & Family-Owned",    desc: "Serving Tracy & the Central Valley for 16 years. Not a franchise. Your neighbors answer the phone." },
    { icon: "leaf",         title: "Energy Efficiency",       desc: "We match you to rebate-eligible systems and handle all utility paperwork. Average client saves $420/yr on energy." },
    { icon: "shield-check", title: "Licensed & Insured",      desc: "CSLB #987654 — fully licensed, bonded, and insured. Every technician background-checked before they're on your property." },
  ],

  formServiceOptions: [
    "AC Repair or Installation",
    "Heating / Furnace",
    "Plumbing",
    "Emergency Service",
    "Maintenance Plan",
  ],

  faq: [
    {
      q: "How quickly can you arrive for emergency service?",
      a: "Our average emergency response time is 45 minutes. We dispatch a technician immediately — no hold music, no voicemail. Call or text us any time, 24/7.",
    },
    {
      q: "Do you offer free estimates?",
      a: "Yes. We provide a free written estimate before any work begins. The price we quote is the price you pay — no surprise charges.",
    },
    {
      q: "Are you licensed and insured?",
      a: "Coolridge Air holds CSLB license #987654, is fully insured, and all technicians are NATE certified — the highest certification in the HVAC industry.",
    },
    {
      q: "What AC and furnace brands do you service?",
      a: "We work on all major brands including Carrier, Trane, Lennox, Rheem, Goodman, York, and more. Our trucks stock parts for the most common systems.",
    },
    {
      q: "Do you offer maintenance plans?",
      a: "Yes. Our annual maintenance plan includes a full tune-up, priority scheduling, and a 15% discount on parts. Most customers save $200+ per year on energy bills alone.",
    },
    {
      q: "Which cities do you serve?",
      a: "We serve Tracy, Stockton, Modesto, Manteca, Lathrop, and Lodi. If you're unsure whether we cover your area, just call — we'll let you know right away.",
    },
    {
      q: "How much does an AC repair or replacement cost?",
      a: "Most AC repairs run $150–$450 depending on the part. Full system replacements range from $3,500–$7,500 installed, depending on unit size and efficiency rating. We always give you an itemized written quote — no guesswork.",
    },
    {
      q: "My heater won't turn on. What should I check first?",
      a: "Check your thermostat batteries and settings first, then your circuit breaker. If those are fine, check the furnace filter — a clogged filter is the #1 cause of furnace shutdowns. If none of that works, call us and we'll diagnose it same day.",
    },
  ],
}

// Re-exports for backward compat
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
