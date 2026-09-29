import type { SiteConfig, Testimonial } from "@core/web/types"
import rawReviews from "./reviews-data.json"

// Real Google reviews for Husky Air, scraped from the business's own Google
// Maps profile (175 total reviews, 4.6★ average). Reviews with no written
// text are excluded from display but still counted in the aggregate rating.
const reviews: Testimonial[] = (rawReviews as Array<{
  name: string
  stars: number
  date: string
  text: string
  avatar: string
  images: string[]
}>).map(r => ({
  name: r.name,
  stars: r.stars,
  text: r.text,
  date: r.date,
  avatar: r.avatar || undefined,
  images: r.images.length ? r.images : undefined,
}))

export const config: SiteConfig = {
  business: {
    name: "Husky Air",
    tagline: "Fast Diagnosis. Fair Pricing. Fixed Right.",
    phone: "(626) 510-3906",
    phoneHref: "tel:+16265103906",
    email: "",
    address: "Mobile dispatch — we come to you",
    city: "San Gabriel Valley",
    serviceAreas: ["Pasadena", "Alhambra", "Monrovia", "Arcadia", "El Monte", "West Covina", "Baldwin Park", "Glendora"],
    since: "",
    google_rating: "4.6",
    review_count: "175",
    emergency: true,
    hours: "Open 24 Hours — Every Day",
    social: { google: "https://www.google.com/maps?cid=10662053144732802014" },
    theme: "clean",
    niche: "hvac",
  },

  about: {
    heading: "Straight Answers. No Runaround.",
    body: "Husky Air has built a 4.6-star reputation on 175 Google reviews by doing the unglamorous things right: showing up, diagnosing the actual problem, and pricing it fairly before any work starts. Customers keep coming back and asking for lead technician Nick by name — for capacitor swaps, mini-split installs, and the middle-of-the-night no-heat calls that can't wait until morning.",
    highlights: [
      { icon: "clock",        text: "Answers day or night — the phone doesn't go to voicemail" },
      { icon: "dollar-sign",  text: "Upfront pricing before any work starts — no surprise invoices" },
      { icon: "shield-check", text: "175 real Google reviews, 4.6★ average — every one shown below" },
    ],
  },

  services: [
    { icon: "thermometer",  image: "/service-1.jpg", title: "AC Repair & Diagnosis",        desc: "Freezing coils, no airflow, warm air blowing when it shouldn't be — we diagnose the real issue first and quote it before touching anything.", urgent: false },
    { icon: "flame",        image: "/service-2.jpg", title: "Heating Repair",               desc: "No heat in the middle of the night doesn't wait for business hours. We're open 24 hours and dispatch around the clock.", urgent: true },
    { icon: "wrench",       image: "/service-3.jpg", title: "Mini-Split Installation",      desc: "Ductless mini-split installs and repairs, including the airflow and capacity issues specific to those systems.", urgent: false },
    { icon: "zap",          image: "/service-4.jpg", title: "Capacitor & Part Replacement", desc: "A failed capacitor is one of the most common reasons an AC won't start. Fast diagnosis, fair price, usually fixed the same visit.", urgent: false },
    { icon: "shield-check", image: "/service-5.jpg", title: "Diagnostics & Tune-Ups",       desc: "Not sure what's wrong? A straight diagnosis over the phone or in person — no guessing games, no upsell script.", urgent: false },
    { icon: "droplets",     image: "/service-6.jpg", title: "Airflow & Air Quality",        desc: "Weak airflow, hot and cold spots, vents that never seem right — we trace it back to the source.", urgent: false },
  ],

  testimonials: reviews,

  trustBadges: [
    "175+ Google Reviews",
    "4.6★ Average Rating",
    "Open 24 Hours",
    "Fair, Upfront Pricing",
    "Fast Diagnosis",
    "AC & Heating Specialists",
  ],

  stats: [
    { value: 4.6, label: "Google Rating",  suffix: "★",  decimals: 1 },
    { value: 175, label: "Google Reviews", suffix: "+",  decimals: 0 },
    { value: 156, label: "5-Star Reviews", suffix: "",   decimals: 0 },
    { value: 24,  label: "Hours a Day",    suffix: "/7", decimals: 0 },
  ],

  reasons: [
    { icon: "clock",       title: "Always Available",                desc: "Open 24 hours, every day. No-heat and no-AC calls don't wait for business hours — neither do we." },
    { icon: "dollar-sign", title: "Fair, Upfront Pricing",            desc: "Customers consistently point to fair, honest pricing in their reviews — quoted before any work starts, no surprises on the invoice." },
    { icon: "award",       title: "175+ Verified Reviews",            desc: "4.6★ average across 175 real Google reviews. Read every one below, not just the good ones." },
    { icon: "thumbs-up",   title: "Customers Ask For Nick",           desc: "Reviewers name lead technician Nick specifically — professional, respectful, and straight about what's actually wrong." },
    { icon: "phone",       title: "We Answer the Phone",              desc: "No hold music, no voicemail maze. Call and talk to a real person about what's going on." },
    { icon: "truck",       title: "Fast Diagnosis, Same-Visit Fixes", desc: "Most jobs — capacitor swaps, mini-split issues, airflow problems — get diagnosed and fixed in one visit." },
    { icon: "smile",       title: "Polite, Respectful Techs",         desc: "12 separate reviewers specifically call out politeness and respect — not just technical skill." },
    { icon: "trending-up", title: "89% Five-Star",                    desc: "156 of 175 Google reviews are 5 stars. Real ratio, not cherry-picked — see the full breakdown below." },
  ],

  formServiceOptions: [
    "AC Repair",
    "Heating Repair",
    "Mini-Split Service",
    "Diagnostic / Tune-Up",
    "Emergency Service",
  ],

  faq: [
    {
      q: "Are you available 24/7?",
      a: "Yes. Husky Air is open 24 hours a day. If your AC or heat goes out at 2am, call — we answer.",
    },
    {
      q: "How much does a repair cost?",
      a: "It depends on what's actually wrong, which is why we diagnose before we quote. Customers consistently mention fair, upfront pricing in their reviews — you'll know the cost before any work starts.",
    },
    {
      q: "Do you work on mini-splits?",
      a: "Yes. Ductless mini-split installation and repair is part of what we do, including diagnosing the airflow issues specific to those systems.",
    },
    {
      q: "What's the most common AC repair?",
      a: "A failed capacitor is one of the most frequent reasons an AC won't start — it's usually a fast, affordable fix.",
    },
    {
      q: "Do you serve my area?",
      a: "We serve the San Gabriel Valley and surrounding areas. If you're not sure we cover your address, call — we'll tell you straight away.",
    },
    {
      q: "Are your reviews real?",
      a: "All 175 reviews on this page are pulled directly from our Google Business Profile — 5-star and 1-star alike. Nothing curated or hidden.",
    },
    {
      q: "How do I book service?",
      a: "Call (626) 510-3906 any time, or fill out the form on this page and we'll get back to you.",
    },
  ],
}

// Re-exports for backward compat
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
