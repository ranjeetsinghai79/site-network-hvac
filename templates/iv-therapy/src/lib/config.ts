import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  tier: "regular",
  business: {
    city: "Tracy",
    theme: "ocean",
    niche: "iv-therapy",
    name: "Revive IV Therapy",
    tagline: "Hydrate. Recover. Thrive.",
    phone: "(555) 345-6789",
    phoneHref: "tel:+15553456789",
    email: "hello@reviveivtherapy.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Stockton", "Manteca", "Mountain House", "Lathrop", "Modesto"],
    license: "CA RN #78234",
    since: "2019",
    google_rating: "5.0",
    review_count: "143",
    emergency: false,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      facebook: "https://facebook.com",
    },
  },

  services: [
    {
      icon: "droplets",
      image: "/service-1.jpg",
      title: "Myers Cocktail",
      desc: "The gold standard IV drip. Magnesium, B vitamins, vitamin C, and calcium. Boosts energy, immunity, and overall wellbeing. Loved by athletes and busy professionals alike.",
      meta: "45 min · $159",
      urgent: false,
    },
    {
      icon: "activity",
      image: "/service-2.jpg",
      title: "NAD+ Anti-Aging",
      desc: "Cellular repair and energy optimization at the molecular level. NAD+ supports DNA repair, brain function, and metabolic health. The most powerful anti-aging drip we offer.",
      meta: "2–4 hrs · from $349",
      urgent: false,
    },
    {
      icon: "zap",
      image: "/service-3.jpg",
      title: "Hydration Drip",
      desc: "Pure saline electrolyte restoration. Ideal for dehydration, heat exhaustion, travel recovery, or post-night-out. Feel rehydrated in 45 minutes — not 8 glasses of water.",
      meta: "30–45 min · $99",
      urgent: false,
    },
    {
      icon: "sparkles",
      image: "/service-4.jpg",
      title: "Immunity Boost",
      desc: "High-dose vitamin C, zinc, glutathione, and B12. Fight off illness, accelerate recovery, and fortify your defenses going into cold and flu season.",
      meta: "45 min · $139",
      urgent: false,
    },
    {
      icon: "star",
      image: "/service-5.jpg",
      title: "Beauty Drip",
      desc: "Biotin, glutathione, vitamin C, and collagen-boosting amino acids. Supports skin radiance, hair strength, and nail growth from the inside out. Glow visible in 24–48 hours.",
      meta: "45 min · $179",
      urgent: false,
    },
    {
      icon: "sun",
      image: "/service-6.jpg",
      title: "Recovery IV",
      desc: "Post-workout or post-procedure recovery accelerator. BCAAs, magnesium, B complex, and anti-inflammatory additives. Back to 100% in hours, not days.",
      meta: "45–60 min · $149",
      urgent: false,
    },
  ],

  about: {
    heading: "Medical-Grade IV Nutrition. Delivered in 45 Minutes.",
    body: "Since 2019, Revive IV Therapy has been the Bay Area's most-trusted mobile IV clinic. Every drip is formulated by a licensed physician and administered by a registered nurse. We bring the treatment to you — office, hotel, gym, or home. 100% bioavailable nutrition that works in real-time, not over hours of drinking water.",
    highlights: [
      { icon: "award",        text: "Physician-formulated drips — every protocol reviewed by a licensed medical doctor" },
      { icon: "zap",          text: "100% bioavailable — direct IV delivery, bypasses digestion for immediate cellular effect" },
      { icon: "dollar-sign",  text: "Mobile service available — we come to your home, office, hotel, or gym" },
    ],
  },

  testimonials: [
    {
      name: "Kevin T.",
      location: "Tracy, CA",
      stars: 5,
      avatar: "https://i.pravatar.cc/80?u=kevin_tracy_iv",
      text: "I do a Myers Cocktail before every big presentation and the difference in clarity and energy is night-and-day. 45 minutes in their clinic and I'm sharp for 3 days straight. Worth every penny.",
    },
    {
      name: "Stephanie N.",
      location: "Stockton, CA",
      stars: 5,
      avatar: "https://i.pravatar.cc/80?u=stephanie_stockton_iv",
      text: "Got the Beauty Drip before my sister's wedding and my skin was glowing in photos. The nurse was professional and the whole thing was relaxing — like a spa treatment but actually medical.",
    },
    {
      name: "Derek H.",
      location: "Manteca, CA",
      stars: 5,
      avatar: "https://i.pravatar.cc/80?u=derek_manteca_iv",
      text: "I run marathons. Recovery IV the day after a race cut my recovery time almost in half. What usually took 4–5 days of soreness was gone in two. I won't race without booking a drip after.",
    },
  ],

  trustBadges: [
    "Physician-Formulated Drips",
    "Registered Nurses Only",
    "100% Bioavailable",
    "Mobile Service Available",
    "Same-Day Appointments",
    "5-Star Rated on Google",
  ],

  stats: [
    { value: 5.0,  label: "Google Rating",       suffix: "★",  decimals: 1 },
    { value: 715,  label: "Drips Administered",  suffix: "+",  decimals: 0 },
    { value: 6,    label: "Years Experience",    suffix: "+",  decimals: 0 },
    { value: 99,   label: "Client Satisfaction", suffix: "%",  decimals: 0 },
  ],

  reasons: [
    {
      icon: "award",
      title: "Physician-Formulated",
      desc: "Every drip protocol is reviewed and approved by a licensed MD. We don't improvise on nutrition dosing.",
    },
    {
      icon: "activity",
      title: "Registered Nurses Only",
      desc: "All IV insertions and administrations performed by licensed RNs. Zero unlicensed staff performing medical procedures.",
    },
    {
      icon: "zap",
      title: "100% Bioavailable",
      desc: "IV delivery bypasses your digestive system entirely. 100% of nutrients reach your bloodstream immediately — unlike oral supplements.",
    },
    {
      icon: "sparkles",
      title: "Same-Day Appointments",
      desc: "Walk in or book online. Most sessions take 30–60 minutes. In and out during your lunch break.",
    },
    {
      icon: "droplets",
      title: "Mobile Service Available",
      desc: "Can't come to us? We come to you. Home, office, hotel, or gym — same clinical standard, delivered.",
    },
    {
      icon: "star",
      title: "Custom Formulations",
      desc: "Off-menu? No problem. Our medical team can formulate add-ons — glutathione pushes, B12 shots, anti-nausea, and more.",
    },
  ],

  formServiceOptions: [
    "Myers Cocktail",
    "NAD+ Anti-Aging",
    "Hydration Drip",
    "Immunity Boost",
    "Beauty Drip",
    "Recovery IV",
  ],

  faq: [
    {
      q: "Is IV therapy safe?",
      a: "Yes — when performed by licensed medical professionals. Every drip is formulated by a physician and administered by a registered nurse. We screen for contraindications before every session and monitor you throughout.",
    },
    {
      q: "How quickly will I feel results?",
      a: "Most clients feel energized and clearer within 30–60 minutes of the drip starting. Hydration improvement is nearly immediate. NAD+ benefits build over 24–72 hours. Beauty Drip results (skin glow, hair) build over 2–4 weeks.",
    },
    {
      q: "How often should I get IV therapy?",
      a: "Depends on your goals. For general wellness: monthly. For athletic recovery: after intense training. For immunity during cold/flu season: weekly or bi-weekly. We'll build a schedule around your lifestyle.",
    },
    {
      q: "Does it hurt?",
      a: "The IV insertion is a small pinch — usually less uncomfortable than a blood draw. Once the IV is placed, the drip itself is painless. Most clients relax, scroll their phones, or even nap during the session.",
    },
    {
      q: "Can I get IV therapy if I'm sick?",
      a: "Yes — in fact, IV immunity drips are most effective when you're fighting something. High-dose vitamin C and zinc delivered intravenously can significantly shorten illness duration.",
    },
    {
      q: "Do you offer mobile service?",
      a: "Yes. We serve Tracy, Stockton, Manteca, and the greater Central Valley. Mobile visits include a small travel fee. Same nurse, same products, same clinical standard as our clinic.",
    },
  ],
}

export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
