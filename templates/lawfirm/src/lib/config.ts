import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
  city: "Tracy",
  theme: "clean",
  niche: "lawfirm",
  name: "Caldwell & Associates",
  tagline: "Fighting For You. Every Case. Every Time.",
  phone: "(555) 567-8901",
  phoneHref: "tel:+15555678901",
  email: "hello@caldwelllaw.com",
  address: "Tracy, California",
  serviceAreas: ["Tracy", "Stockton", "Modesto", "Sacramento", "San Jose", "Oakland"],
  license: "California State Bar #456789",
  since: "2003",
  google_rating: "4.9",
  review_count: "156",
  emergency: true,
  social: { google: "https://google.com", yelp: "https://yelp.com", facebook: "https://facebook.com" },
  attorney: {
    name: "Michael Caldwell",
    credentials: "J.D., UC Davis School of Law · California State Bar #456789 · AV Preeminent® Rated",
    bio: "For over 20 years, Michael has fought for ordinary people against insurance companies, corporations, and an often-indifferent legal system. He started Caldwell & Associates after watching a family friend's injury claim get lowballed by an adjuster. Today, his firm has recovered over $50 million for clients across Northern California.",
    yearsExp: 23,
  },
},

  services: [
  { icon: "car",       image: "/service-1.jpg", title: "Personal Injury",  desc: "Car accidents, slip & fall, workplace injuries. No fee unless we win. Maximum compensation for your suffering.", urgent: true },
  { icon: "users",     image: "/service-4.jpg", title: "Family Law",       desc: "Divorce, child custody, spousal support, and adoption. Protecting your family's future with compassion and strength.", urgent: false },
  { icon: "shield",    image: "/service-5.jpg", title: "Criminal Defense", desc: "DUI, drug charges, assault, theft. We defend your rights aggressively from arrest through trial.", urgent: true },
  { icon: "briefcase", image: "/service-6.jpg", title: "Business Law",     desc: "Contracts, partnerships, LLC formation, disputes. Legal protection for every stage of your business.", urgent: false },
  { icon: "file-text", image: "/service-3.jpg", title: "Estate Planning",  desc: "Wills, trusts, power of attorney, and probate. Secure your legacy and protect your loved ones.", urgent: false },
  { icon: "globe",     image: "/service-2.jpg", title: "Immigration Law",  desc: "Visas, green cards, citizenship, deportation defense. Navigating complex immigration with decades of experience.", urgent: false },
],

  about: {
    heading: "Real Attorneys. Real Results. Fighting for Real People.",
    body: "Since 2003, Caldwell & Associates has recovered over $50 million for ordinary people facing insurance companies, corporations, and a legal system that doesn't always play fair. Michael Caldwell started this firm after watching a family friend's injury claim get lowballed. No fee unless we win. Free consultation, always.",
    highlights: [
      { icon: "dollar-sign",  text: "No fee unless we win — you pay zero attorney fees unless we recover money for you" },
      { icon: "shield",       text: "20+ years of trial experience — insurers settle faster when they know we'll go to court" },
      { icon: "users",        text: "Bilingual staff — English and Spanish, available 24/7 for legal emergencies" },
    ],
  },

  testimonials: [
  { name: "David R.", location: "Tracy, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=david_tracy_lawfirm", text: "After my car accident, I was overwhelmed. Caldwell & Associates handled everything — insurance, medical bills, settlement. Got 3x what the insurance offered." },
  { name: "Maria G.", location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=maria_stockton_lawfirm", text: "Went through a difficult divorce with children involved. They fought hard for my custody rights while being sensitive to the emotional toll. Couldn't have done it without them." },
  { name: "James T.", location: "Modesto, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=james_modesto_lawfirm", text: "Faced criminal charges that could have ruined my career. They had the charges dismissed. Professional, responsive, and genuinely cared about my outcome." },
],

  trustBadges: [
  "20+ Years Experience", "No Fee Unless We Win", "Free Consultations",
  "AV Preeminent Rated", "Super Lawyers 2024", "1,000+ Cases Won"
],

  stats: [
  { value: 4.9,  label: "Google Rating",        suffix: "★",   decimals: 1 },
  { value: 1000, label: "Cases Won",            suffix: "+",   decimals: 0 },
  { value: 23,   label: "Years Experience",     suffix: "+",   decimals: 0 },
  { value: 50,   label: "Million Recovered",    suffix: "M+",  decimals: 0 },
],

  reasons: [
  { "icon": "dollar-sign", "title": "No Fee Unless We Win", "desc": "You pay nothing unless we recover money for you. Zero upfront cost — ever." },
  { "icon": "star", "title": "Free Case Evaluation", "desc": "Speak with an attorney today at no charge. Know your rights before you decide anything." },
  { "icon": "award", "title": "Trial Experience", "desc": "We're not afraid to go to court. Insurance companies know it — and settle faster." },
  { "icon": "clock", "title": "Available 24/7", "desc": "Legal emergencies don't follow business hours. Neither do we." },
  { "icon": "users", "title": "Bilingual Staff", "desc": "English and Spanish-speaking attorneys. Clear communication matters when your freedom is at stake." },
  { "icon": "shield", "title": "Proven Results", "desc": "1,000+ cases won. We have a track record that speaks louder than promises." }
],

  formServiceOptions: [
  "Personal Injury",
  "Family Law",
  "Criminal Defense",
  "Business Law",
  "Estate Planning",
  "Immigration Law",
],

  faq: [
    {
      q: "How much does it cost to hire an attorney?",
      a: "For personal injury cases, nothing upfront. We work on contingency — you pay zero attorney fees unless we win your case. Initial consultations are always free for all practice areas.",
    },
    {
      q: "How long will my case take?",
      a: "Simple personal injury settlements can resolve in 3–6 months. Cases that go to trial can take 1–2 years. We'll give you a realistic timeline after reviewing your case — no false promises.",
    },
    {
      q: "What should I do immediately after an accident?",
      a: "Call 911 if injured. Document everything — photos, witness names, insurance info. See a doctor even if you feel okay (injuries often appear 24–48 hours later). Then call us. Do not give a recorded statement to the other insurance company.",
    },
    {
      q: "The insurance company made me an offer. Should I accept?",
      a: "Don't accept without talking to us first — it's almost always too low. We offer a free case review and will tell you honestly if the offer is fair. If we can do better, we'll fight for it.",
    },
    {
      q: "Do you handle criminal cases?",
      a: "Yes. We handle DUI, drug charges, assault, theft, and other criminal matters. Criminal emergencies move fast — call us as soon as possible after an arrest, before speaking with police.",
    },
    {
      q: "Do you have Spanish-speaking attorneys?",
      a: "Yes. We have bilingual attorneys and staff fluent in Spanish. Clear communication matters most when your freedom, family, or finances are at stake.",
    },
  ],
}

// Backward compat re-exports
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
