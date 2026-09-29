import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  tier: "regular",
  business: {
    city: "Tracy",
    theme: "slate",
    niche: "skin-clinic",
    name: "Glow Skin Clinic",
    tagline: "Your Best Skin, Revealed.",
    phone: "(555) 234-5678",
    phoneHref: "tel:+15552345678",
    email: "hello@glowskinclinic.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Stockton", "Manteca", "Mountain House", "Lodi", "Modesto"],
    license: "CA DERM #45321",
    since: "2016",
    google_rating: "4.9",
    review_count: "187",
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
      title: "Chemical Peels",
      desc: "Resurface and renew with medical-grade chemical peels for acne, hyperpigmentation, fine lines, and uneven texture. Zero-downtime options available.",
      meta: "45 min · from $149",
      urgent: false,
    },
    {
      icon: "zap",
      image: "/service-2.jpg",
      title: "Laser Resurfacing",
      desc: "Target stubborn pigmentation, sun damage, acne scars, and signs of aging with our fractional laser technology. Safe for all skin tones.",
      meta: "60 min · from $299/session",
      urgent: false,
    },
    {
      icon: "droplets",
      image: "/service-3.jpg",
      title: "Acne Treatments",
      desc: "Comprehensive acne management combining clinical extractions, prescription-strength serums, and light therapy. Clear skin in 4–6 sessions.",
      meta: "60 min · from $125",
      urgent: false,
    },
    {
      icon: "sun",
      image: "/service-4.jpg",
      title: "Anti-Aging Facials",
      desc: "Collagen-stimulating treatments using retinol, peptides, and growth factors. Visibly firmer, smoother skin with zero downtime.",
      meta: "60–75 min · from $175",
      urgent: false,
    },
    {
      icon: "activity",
      image: "/service-5.jpg",
      title: "Dermaplaning",
      desc: "Manual exfoliation removes dead skin cells and vellus hair. Instantly smoother, brighter skin. Perfect pre-event glow treatment.",
      meta: "30 min · from $85",
      urgent: false,
    },
    {
      icon: "star",
      image: "/service-6.jpg",
      title: "Microneedling",
      desc: "Collagen induction therapy for scars, pores, and texture. PRP add-on available for supercharged results. 3-session packages from $699.",
      meta: "75 min · from $275",
      urgent: false,
    },
  ],

  about: {
    heading: "Clinical Expertise. Visible Results. No Judgment — Ever.",
    body: "Since 2016, Glow Skin Clinic has been the dermatology clinic Tracy trusts for real results. Every treatment is performed by licensed skincare professionals — not estheticians. We carry only clinically proven protocols and medical-grade products. Free skin consultations for every new client. No pressure, no upselling.",
    highlights: [
      { icon: "award",        text: "Licensed providers only — every treatment performed by certified skin specialists" },
      { icon: "sparkles",     text: "Clinically proven protocols — only FDA-cleared devices and medical-grade products" },
      { icon: "dollar-sign",  text: "Flexible financing — CareCredit accepted, 0% APR options for treatment packages" },
    ],
  },

  testimonials: [
    {
      name: "Jessica M.",
      location: "Tracy, CA",
      stars: 5,
      avatar: "https://i.pravatar.cc/80?u=jessica_tracy_skinclinic",
      text: "Three chemical peels in and my skin has never looked better. The hyperpigmentation I've had for years is almost completely gone. My provider actually listened to my concerns instead of just trying to sell me everything.",
    },
    {
      name: "Maria G.",
      location: "Stockton, CA",
      stars: 5,
      avatar: "https://i.pravatar.cc/80?u=maria_stockton_skinclinic",
      text: "I struggled with cystic acne for 12 years. After 6 sessions here I'm 90% clear and my confidence is completely different. They built a plan specifically for my skin — not a one-size-fits-all menu.",
    },
    {
      name: "Aisha P.",
      location: "Manteca, CA",
      stars: 5,
      avatar: "https://i.pravatar.cc/80?u=aisha_manteca_skinclinic",
      text: "Got dermaplaning before my wedding and my skin was absolutely glowing. My makeup sat perfectly. I've made this a monthly ritual — 30 minutes and I walk out looking like I've been on vacation.",
    },
  ],

  trustBadges: [
    "Licensed Skin Specialists",
    "Medical-Grade Products",
    "FDA-Cleared Devices",
    "Free Consultations",
    "Financing Available",
    "5-Star Rated on Google",
  ],

  stats: [
    { value: 4.9,  label: "Google Rating",       suffix: "★",  decimals: 1 },
    { value: 940,  label: "Treatments Done",     suffix: "+",  decimals: 0 },
    { value: 9,    label: "Years Experience",    suffix: "+",  decimals: 0 },
    { value: 97,   label: "Client Satisfaction", suffix: "%",  decimals: 0 },
  ],

  reasons: [
    {
      icon: "award",
      title: "Licensed Skin Specialists",
      desc: "Every treatment performed by certified providers. We never let untrained staff touch your skin.",
    },
    {
      icon: "sparkles",
      title: "Medical-Grade Products Only",
      desc: "We stock pharmaceutical-grade serums and use only FDA-cleared devices — the same used in top dermatology practices.",
    },
    {
      icon: "star",
      title: "Free Skin Consultations",
      desc: "Every new client gets a complimentary skin assessment. We'll map out a realistic plan before you spend a dollar.",
    },
    {
      icon: "dollar-sign",
      title: "Financing Available",
      desc: "CareCredit accepted with 0% APR options. Treatment packages from $299 fit any budget.",
    },
    {
      icon: "droplets",
      title: "Clinically Proven Protocols",
      desc: "No trends, no gimmicks. Every treatment is evidence-based and tailored to your skin type and goals.",
    },
    {
      icon: "activity",
      title: "Personalized Treatment Plans",
      desc: "Your skin is unique. We build custom treatment sequences around your concerns, timeline, and budget — not our sales targets.",
    },
  ],

  formServiceOptions: [
    "Chemical Peels",
    "Laser Resurfacing",
    "Acne Treatments",
    "Anti-Aging Facials",
    "Dermaplaning",
    "Microneedling",
  ],

  faq: [
    {
      q: "How many sessions will I need to see results?",
      a: "Most clients see noticeable improvement after 1–3 sessions for mild concerns (texture, glow) and 4–6 for deeper issues (acne scars, hyperpigmentation, fine lines). We'll set realistic expectations at your free consultation.",
    },
    {
      q: "Is there downtime after treatments?",
      a: "Depends on the treatment. Dermaplaning and mild peels: zero downtime. Medium peels and laser: 3–7 days of redness and peeling. We always brief you fully before booking so you can plan around your schedule.",
    },
    {
      q: "Are your treatments safe for darker skin tones?",
      a: "Yes. We're experienced in treating all Fitzpatrick skin types. We adjust peel strengths and laser settings specifically for your tone. We never use protocols that risk post-inflammatory hyperpigmentation on darker skin.",
    },
    {
      q: "What's the difference between a chemical peel and microneedling?",
      a: "Peels use acids to exfoliate and resurface the skin from the outside in. Microneedling triggers your skin's own collagen response from the inside out. Many clients benefit from both — we'll tell you which fits your goals best.",
    },
    {
      q: "How much does a treatment package cost?",
      a: "Single sessions from $85 (dermaplaning) to $299 (laser). We offer 3-session packages at 15% off and memberships with monthly treatments from $149/month. Financing available through CareCredit.",
    },
    {
      q: "Can I combine treatments in one visit?",
      a: "Yes — many clients combine dermaplaning with a peel or a facial with LED light therapy. We'll tell you which combinations are safe and effective for your skin type.",
    },
  ],
}

export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
