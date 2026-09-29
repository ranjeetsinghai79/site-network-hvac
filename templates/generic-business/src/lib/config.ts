import type { SiteConfig } from "@core/web/types"

// Placeholder only — pipeline/src/agents/config-generator.ts overwrites this
// file entirely with real business data at build time. This fallback exists
// so `npm run dev:generic-business` renders something sane, and so any
// business type not covered by a niche-specific template (see
// pipeline/src/agents/builder.ts's NICHE_TEMPLATE_DIR) still gets a real,
// working site instead of a failed build.
export const config: SiteConfig = {
  business: {
    city: "Tracy",
    theme: "clean",
    niche: "hvac",
    name: "Your Business Name",
    tagline: "Local, Trusted, Reliable.",
    phone: "(555) 654-0789",
    phoneHref: "tel:+15556540789",
    email: "hello@yourbusiness.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Mountain House", "Manteca", "Stockton", "Brentwood", "Lathrop"],
    since: "2015",
    google_rating: "4.9",
    review_count: "120",
    emergency: false,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      instagram: "https://instagram.com",
      facebook: "https://facebook.com",
    },
  },

  about: {
    heading: "Local Service You Can Actually Trust",
    body: "We're a locally owned business serving the community with honest work, fair pricing, and a team that shows up when they say they will.",
    highlights: [
      { icon: "star",        text: "Locally owned and operated" },
      { icon: "shield-check", text: "Licensed, insured, background-checked team" },
      { icon: "clock",       text: "Fast response, clear communication" },
    ],
  },

  services: [
    { icon: "check",  image: "/service-1.jpg", title: "Service One",   desc: "A short, clear description of the first thing this business does for its customers.", urgent: false },
    { icon: "check",  image: "/service-2.jpg", title: "Service Two",   desc: "A short, clear description of the second thing this business does for its customers.", urgent: false },
    { icon: "check",  image: "/service-3.jpg", title: "Service Three", desc: "A short, clear description of the third thing this business does for its customers.", urgent: false },
    { icon: "check",  image: "/service-4.jpg", title: "Service Four",  desc: "A short, clear description of the fourth thing this business does for its customers.", urgent: false },
  ],

  testimonials: [
    { name: "Jamie R.",  location: "Tracy, CA",         stars: 5, avatar: "https://i.pravatar.cc/80?u=jamie_generic", text: "Great experience from start to finish. Showed up on time and did exactly what they said they would." },
    { name: "Morgan T.", location: "Mountain House, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=morgan_generic", text: "Clear pricing, no surprises, and the work held up. Would use them again." },
    { name: "Sam K.",    location: "Manteca, CA",        stars: 5, avatar: "https://i.pravatar.cc/80?u=sam_generic", text: "Responsive and professional. Exactly what you want from a local business." },
  ],

  trustBadges: [
    "Locally Owned",
    "Licensed & Insured",
    "Fast Response",
    "5-Star Rated",
  ],

  stats: [
    { value: 4.9, label: "Google Rating",  suffix: "★", decimals: 1 },
    { value: 120, label: "Happy Customers", suffix: "+", decimals: 0 },
    { value: 10,  label: "Years in Business", suffix: "+", decimals: 0 },
  ],

  reasons: [
    { icon: "award",        title: "Locally Owned",   desc: "We live and work in this community — our reputation depends on doing it right." },
    { icon: "shield-check", title: "Fully Insured",   desc: "Licensed and insured so you're protected at every step." },
    { icon: "star",         title: "5-Star Service",  desc: "Consistent, reliable work that keeps customers coming back." },
    { icon: "users",        title: "Our Own Team",    desc: "No subcontractors — the people who show up are the people you hired." },
  ],

  faq: [
    { q: "Do you offer free quotes?", a: "Yes — reach out and we'll get you a straight quote, no obligation." },
    { q: "What areas do you serve?", a: "We serve the local area and surrounding communities — check the service area list above." },
    { q: "How fast can you respond?", a: "We aim to respond the same day for most requests." },
  ],

  formServiceOptions: [
    "General Inquiry",
    "Request a Quote",
    "Schedule Service",
  ],
}
