import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
  city: "Tracy",
  theme: "clean",
  niche: "dentist",
  name: "Bright Smile Dental",
  tagline: "Gentle Care. Beautiful Results.",
  phone: "(555) 345-6789",
  phoneHref: "tel:+15553456789",
  email: "hello@brightsmiledelta.com",
  address: "Tracy, California",
  serviceAreas: ["Tracy", "Stockton", "Manteca", "Mountain House", "Lathrop", "Banta"],
  license: "CA DDS #54321",
  since: "2010",
  google_rating: "4.9",
  review_count: "418",
  emergency: true,
  social: {
    google: "https://google.com",
    yelp: "https://yelp.com",
    facebook: "https://facebook.com",
  },
},

  services: [
  {
    icon: "sparkles",
    image: "/service-2.jpg",
    title: "Teeth Whitening",
    desc: "Professional Zoom whitening — up to 8 shades brighter in one visit. Take-home kits also available.",
    urgent: false,
  },
  {
    icon: "shield-check",
    image: "/service-1.jpg",
    title: "Preventive Cleanings",
    desc: "Comprehensive exams, digital X-rays, and thorough cleanings. Semi-annual visits for a lifetime of healthy teeth.",
    urgent: false,
  },
  {
    icon: "smile",
    image: "/service-4.jpg",
    title: "Dental Implants",
    desc: "Permanent tooth replacement that looks and feels natural. Single crowns to full arch restorations.",
    urgent: false,
  },
  {
    icon: "align-center",
    image: "/service-3.jpg",
    title: "Invisalign & Braces",
    desc: "Straighten your smile discreetly. Clear aligners for teens and adults. Free orthodontic consultation.",
    urgent: false,
  },
  {
    icon: "zap",
    image: "/service-5.jpg",
    title: "Emergency Dental",
    desc: "Severe pain, broken tooth, lost crown? Same-day emergency slots reserved daily. Call us first.",
    urgent: true,
  },
  {
    icon: "star",
    image: "/service-6.jpg",
    title: "Cosmetic Dentistry",
    desc: "Veneers, bonding, gum contouring, and smile makeovers. Your dream smile is closer than you think.",
    urgent: false,
  },
],

  about: {
    heading: "Gentle Dentistry That Actually Makes You Look Forward to Your Appointment",
    body: "Since 2010, Bright Smile Dental has made dental care something Tracy families actually look forward to. Dr. Kim and her team specialize in anxiety-free dentistry — no judgment, no lectures, just gentle thorough care. Over 2,000 patients trust us with their smiles. Most insurance accepted, same-day emergencies, kids welcome.",
    highlights: [
      { icon: "heart",        text: "Anxiety-free dentistry — relaxed chair-side manner, nitrous oxide available" },
      { icon: "clock",        text: "Same-day emergency slots — severe pain or broken tooth seen today" },
      { icon: "dollar-sign",  text: "Most insurance accepted — CareCredit and Sunbit financing also available" },
    ],
  },

  testimonials: [
  {
    name: "Jennifer P.",
    location: "Tracy, CA",
    stars: 5,
    avatar: "https://i.pravatar.cc/80?u=jennifer_tracy_dentist",
    text: "Hadn't been to a dentist in 6 years due to anxiety. Dr. Kim was so patient and gentle. Now I actually look forward to my appointments.",
  },
  {
    name: "Carlos R.",
    location: "Stockton, CA",
    stars: 5,
    avatar: "https://i.pravatar.cc/80?u=carlos_stockton_dentist",
    text: "Got Invisalign here. The whole process was explained clearly, results were amazing. Staff made every visit easy and fun.",
  },
  {
    name: "Melissa T.",
    location: "Manteca, CA",
    stars: 5,
    avatar: "https://i.pravatar.cc/80?u=melissa_manteca_dentist",
    text: "Chipped a tooth Saturday morning. They got me in within 2 hours. Fixed it perfectly, matched my other teeth exactly. Incredible service.",
  },
],

  trustBadges: [
  "Accepting New Patients",
  "Most Insurance Accepted",
  "Anxiety-Free Dentistry",
  "Digital X-Rays",
  "Same-Day Emergencies",
  "Family & Cosmetic Dentist",
],

  stats: [
  { value: 4.9,  label: "Google Rating",        suffix: "★",  decimals: 1 },
  { value: 2090, label: "Smiles Transformed",   suffix: "+",  decimals: 0 },
  { value: 16,   label: "Years Experience",     suffix: "+",  decimals: 0 },
  { value: 98,   label: "Anxiety-Free Rating",  suffix: "%",  decimals: 0 },
],

  reasons: [
  { "icon": "heart", "title": "Gentle & Painless", "desc": "Anxiety about the dentist? We specialize in relaxed, pain-free care. You're safe here." },
  { "icon": "clock", "title": "Same-Day Emergency", "desc": "Severe toothache or broken tooth? We fit you in today — no waiting through the weekend." },
  { "icon": "star", "title": "Children Welcome", "desc": "Kid-friendly environment and techniques. We make first dental visits something to look forward to." },
  { "icon": "dollar-sign", "title": "Financing Available", "desc": "CareCredit, Sunbit, and in-office plans. Beautiful, healthy teeth shouldn't be a financial stress." },
  { "icon": "zap", "title": "Digital X-Rays", "desc": "90% less radiation than traditional X-rays. Instant results, no waiting for film to develop." },
  { "icon": "shield", "title": "Sedation Available", "desc": "Nitrous oxide and oral sedation options. Sleep through your appointment if that's what you need." }
],

  formServiceOptions: [
  "Teeth Whitening",
  "Preventive Cleanings",
  "Dental Implants",
  "Invisalign & Braces",
  "Emergency Dental",
  "Cosmetic Dentistry",
],

  faq: [
    {
      q: "Do you accept my dental insurance?",
      a: "We accept most PPO plans including Delta Dental, Cigna, Aetna, MetLife, and United Healthcare. We verify your benefits before your appointment so you know exactly what's covered — no surprises.",
    },
    {
      q: "What if I'm scared of the dentist?",
      a: "You're not alone — about 40% of our patients have dental anxiety. We specialize in gentle, judgment-free care. We explain every step before we do it. Nitrous oxide (laughing gas) is available, and we stop whenever you raise a hand.",
    },
    {
      q: "Do you take same-day emergencies?",
      a: "Yes. We reserve daily emergency slots for patients with severe pain, broken teeth, or lost crowns. Call us first thing and we'll do our best to see you that day — even if you're a new patient.",
    },
    {
      q: "How much does teeth whitening cost?",
      a: "In-office Zoom whitening runs $299–$399. Take-home custom tray kits are $199. We often run new-patient whitening specials — ask when you call.",
    },
    {
      q: "How often do I actually need to come in?",
      a: "Every 6 months is the standard and what insurance covers. Some patients with gum disease or high cavity risk benefit from 3–4 month cleanings. We'll recommend the right interval for your situation.",
    },
    {
      q: "What age should my child first see a dentist?",
      a: "The American Academy of Pediatric Dentistry recommends the first visit by age 1 or when the first tooth erupts. Early visits build comfort and let us catch developmental issues early. Kids love our office.",
    },
  ],
}

// Backward compat re-exports
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
