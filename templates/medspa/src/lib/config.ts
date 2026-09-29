import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  tier: "regular",
  business: {
  city: "Tracy",
  theme: "champagne",
  niche: "medspa",
  name: "Lumière Med Spa",
  tagline: "Where Science Meets Beauty.",
  phone: "(555) 456-7890",
  phoneHref: "tel:+15554567890",
  email: "hello@lumieremedspa.com",
  address: "Tracy, California",
  serviceAreas: ["Tracy", "Stockton", "Manteca", "Mountain House", "Dublin", "Pleasanton"],
  license: "CA MED #98765",
  since: "2015",
  google_rating: "5.0",
  review_count: "234",
  emergency: false,
  social: {
    google: "https://google.com",
    yelp: "https://yelp.com",
    facebook: "https://facebook.com",
  },
},

  services: [
  {
    icon: "sparkles",
    image: "/service-1.jpg",
    title: "Botox & Fillers",
    desc: "Natural-looking wrinkle reduction and volume restoration. Board-certified injectors. Results you'll love.",
    meta: "30 min · from $299",
    urgent: false,
  },
  {
    icon: "zap",
    image: "/service-3.jpg",
    title: "Laser Treatments",
    desc: "Laser hair removal and skin resurfacing on all skin types. Permanent results with medical-grade devices.",
    meta: "45–60 min · from $149/session",
    urgent: false,
  },
  {
    icon: "droplets",
    image: "/service-6.jpg",
    title: "HydraFacial",
    desc: "Deep cleanse, extract, and hydrate in 30 minutes. Instant glow. Zero downtime. A client favorite.",
    meta: "30–45 min · from $175",
    urgent: false,
  },
  {
    icon: "sun",
    image: "/service-2.jpg",
    title: "Dermal Fillers",
    desc: "Restore volume and smooth deep folds. Juvederm, Sculptra, and Restylane by board-certified providers.",
    meta: "30 min · from $125",
    urgent: false,
  },
  {
    icon: "activity",
    image: "/service-5.jpg",
    title: "Microneedling",
    desc: "Stimulate collagen naturally. Treats scars, texture, and signs of aging. PRP add-on available.",
    meta: "60–75 min · from $350",
    urgent: false,
  },
  {
    icon: "star",
    image: "/service-4.jpg",
    title: "Body Contouring",
    desc: "Non-surgical fat reduction and skin tightening. CoolSculpting and RF to sculpt your silhouette.",
    meta: "45 min · from $499/area",
    urgent: false,
  },
],

  about: {
    heading: "Clinical Results. Spa Experience. No Judgment — Ever.",
    body: "Since 2015, Lumière has been the med spa Tracy and the Bay Area trust for results that actually look natural. Every treatment is performed by board-certified medical providers — not estheticians. We carry only FDA-approved injectables and medical-grade devices. Complimentary consultations for every new client. No pressure, ever.",
    highlights: [
      { icon: "award",        text: "Board-certified providers only — licensed MDs, NPs, and PAs for all treatments" },
      { icon: "sparkles",     text: "FDA-approved treatments — Botox, Juvederm, Dysport, Sculptra, and more" },
      { icon: "dollar-sign",  text: "Flexible financing — CareCredit and Affirm accepted, 0% APR options available" },
    ],
  },

  testimonials: [
  {
    name: "Amanda W.",
    location: "Tracy, CA",
    stars: 5,
    avatar: "https://i.pravatar.cc/80?u=amanda_tracy_medspa",
    text: "My Botox looks so natural — exactly what I wanted. The injector took so much time to understand my goals. I've been coming back every 4 months for 2 years.",
  },
  {
    name: "Priya K.",
    location: "Stockton, CA",
    stars: 5,
    avatar: "https://i.pravatar.cc/80?u=priya_stockton_medspa",
    text: "Laser hair removal changed my life. After 6 sessions, I'm basically hair-free. The staff made me feel comfortable the entire time.",
  },
  {
    name: "Rachel D.",
    location: "Dublin, CA",
    stars: 5,
    avatar: "https://i.pravatar.cc/80?u=rachel_dublin_medspa",
    text: "Monthly HydraFacials have completely transformed my skin. I get compliments constantly. Worth every single penny.",
  },
],

  trustBadges: [
  "Board-Certified Providers",
  "FDA-Approved Treatments",
  "Medical-Grade Products",
  "Free Consultations",
  "Financing Available",
  "5-Star Rated on Google",
],

  stats: [
  { value: 5,    label: "Google Rating",        suffix: "★",  decimals: 1 },
  { value: 1170, label: "Treatments Done",      suffix: "+",  decimals: 0 },
  { value: 11,   label: "Years Experience",     suffix: "+",  decimals: 0 },
  { value: 98,   label: "Client Satisfaction",  suffix: "%",  decimals: 0 },
],

  reasons: [
  {
    "icon": "award",
    "title": "Board-Certified Injectors",
    "desc": "Every treatment performed by licensed medical providers. No estheticians administering injectables — ever."
  },
  {
    "icon": "sparkles",
    "title": "FDA-Approved Treatments",
    "desc": "We use only FDA-cleared devices and clinically proven injectables. No off-brand or counterfeit products."
  },
  {
    "icon": "star",
    "title": "Free Consultations",
    "desc": "Every new client gets a complimentary skin assessment. No pressure — just personalized recommendations."
  },
  {
    "icon": "dollar-sign",
    "title": "Financing Available",
    "desc": "CareCredit and Affirm accepted. 0% APR options available so you can start your journey today."
  },
  {
    "icon": "droplets",
    "title": "Medical-Grade Products",
    "desc": "We stock only pharmaceutical-grade skincare — the same lines used in top Beverly Hills practices."
  },
  {
    "icon": "activity",
    "title": "Personalized Treatment Plans",
    "desc": "No one-size-fits-all menus here. Your provider builds a plan around your skin, goals, and budget."
  }
],

  formServiceOptions: [
  "Botox & Fillers",
  "Laser Hair Removal",
  "HydraFacial",
  "Chemical Peels",
  "Microneedling",
  "Body Contouring",
],

  faq: [
    {
      q: "What's the difference between Botox and fillers?",
      a: "Botox relaxes muscles that cause dynamic wrinkles (forehead, crow's feet, 11s). Fillers add volume to static areas — lips, cheeks, nasolabial folds. Many clients use both. We'll recommend what makes sense for your specific goals.",
    },
    {
      q: "How long does Botox last?",
      a: "Typically 3–4 months. With regular treatments, many patients find it lasts longer over time as the muscles relax. We'll set a maintenance schedule that fits your lifestyle and budget.",
    },
    {
      q: "Is it safe? Are you actually medical?",
      a: "Yes. Every injectable treatment is performed by a board-certified nurse practitioner, PA, or MD. We never allow estheticians to administer Botox or fillers. We use only FDA-cleared products and devices.",
    },
    {
      q: "Will it look natural or overdone?",
      a: "Natural results are our standard. Our goal is for people to say 'you look great' — not 'did you get work done?' We can always add more at your two-week follow-up. Less is more.",
    },
    {
      q: "How much does a HydraFacial cost?",
      a: "From $175 for a classic HydraFacial (30 min). Deluxe with boosters runs $225–$275. We offer monthly memberships for significant savings. First-time clients get a complimentary skin assessment.",
    },
    {
      q: "How many laser hair removal sessions will I need?",
      a: "Most clients achieve 80–90% permanent hair reduction in 6 sessions spaced 4–6 weeks apart. Hormonal areas may need a few extra. Touch-ups once or twice a year maintain results.",
    },
  ],
}

// Backward compat re-exports
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
