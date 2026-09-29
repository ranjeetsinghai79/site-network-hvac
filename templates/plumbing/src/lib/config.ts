import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    city: "Tracy",
    theme: "clean",
    niche: "plumbing",
    name: "FlowRight Plumbing",
    tagline: "Fixed Fast. Fixed Right.",
    phone: "(555) 789-0123",
    phoneHref: "tel:+15557890123",
    email: "hello@flowrightplumbing.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Mountain House", "Manteca", "Stockton", "Lathrop", "Modesto"],
    license: "CSLB #445678",
    since: "2009",
    google_rating: "4.9",
    review_count: "612",
    emergency: true,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      facebook: "https://facebook.com",
    },
  },

  about: {
    heading: "Tracy's Most Trusted Plumbers — 15+ Years, Zero Surprises",
    body: "Since 2009, FlowRight has handled every plumbing job in Tracy and the Central Valley — from leaky faucets to full repiping. We're licensed, insured, and available 24/7 for emergencies. Flat-rate pricing means you know the cost before we touch a single pipe. No trip charges, no hidden fees.",
    highlights: [
      { icon: "clock",       text: "24/7 emergency response — licensed plumber on call, no extra charge" },
      { icon: "dollar-sign", text: "Flat-rate pricing — you approve the price before any work starts" },
      { icon: "shield-check", text: "CSLB licensed & fully insured — every job permitted when required" },
    ],
  },

  services: [
    { icon: "droplets",    image: "/service-1.jpg", title: "Drain Cleaning",          desc: "Slow drains, complete blockages, hydro-jetting for roots. We clear it fast and tell you why it clogged so it doesn't happen again.", urgent: false },
    { icon: "zap",         image: "/service-2.jpg", title: "Water Heater Repair",     desc: "Tank and tankless water heater repair or replacement. Same-day service available. ENERGY STAR units in stock.", urgent: true },
    { icon: "home",        image: "/service-3.jpg", title: "Repiping Services",        desc: "Whole-house copper or PEX repiping. Stop recurring leaks and low pressure for good. Work comes with 25-year warranty.", urgent: false },
    { icon: "search",      image: "/service-4.jpg", title: "Leak Detection",           desc: "Non-invasive electronic leak detection — we find slab leaks, wall leaks, and underground breaks without digging up your yard.", urgent: true },
    { icon: "settings",    image: "/service-5.jpg", title: "Fixture Installation",     desc: "Faucets, toilets, garbage disposals, dishwashers. We supply or install yours. Includes full leak test and cleanup.", urgent: false },
    { icon: "cloud-rain",  image: "/service-6.jpg", title: "Sewer Line Services",      desc: "Camera inspection, root removal, spot repair, full replacement. We show you the video before recommending any work.", urgent: false },
  ],

  testimonials: [
    { name: "Dave R.",    location: "Tracy, CA",    stars: 5, avatar: "https://i.pravatar.cc/80?u=dave_tracy_plumbing",    text: "Slab leak found and fixed in the same day. They didn't have to tear up half my floor like I expected. Incredible work." },
    { name: "Maria L.",   location: "Manteca, CA",  stars: 5, avatar: "https://i.pravatar.cc/80?u=maria_manteca_plumbing",  text: "Tankless water heater went out on a Sunday night. FlowRight had a plumber here Monday morning and it was done by noon. Lifesavers." },
    { name: "Kevin T.",   location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=kevin_stockton_plumbing", text: "Quoted the job before starting, stuck to the price, finished early. That's everything you want in a contractor." },
  ],

  trustBadges: [
    "CSLB Licensed & Insured",
    "24/7 Emergency Service",
    "Flat-Rate Pricing",
    "No Trip Charges",
    "Slab Leak Specialists",
    "5-Star Google Rated",
  ],

  stats: [
    { value: 4.9,  label: "Google Rating",    suffix: "★",  decimals: 1 },
    { value: 612,  label: "Jobs Completed",   suffix: "+",  decimals: 0 },
    { value: 15,   label: "Years Experience", suffix: "+",  decimals: 0 },
    { value: 60,   label: "Minute Response",  suffix: "min", decimals: 0 },
  ],

  reasons: [
    { icon: "clock",        title: "24/7 Emergency",      desc: "Burst pipe at 2am? We're on it. Same licensed plumber, same flat-rate pricing — no emergency surcharges." },
    { icon: "dollar-sign",  title: "Flat-Rate Pricing",   desc: "You get the price upfront. We don't start until you approve. No surprises on the final invoice." },
    { icon: "shield-check", title: "CSLB Licensed",       desc: "Full state license and insurance. Every job permitted when required. Your home is protected." },
    { icon: "search",       title: "Electronic Detection", desc: "We find slab leaks and wall leaks without destroying your home. Non-invasive technology, surgical repairs." },
    { icon: "award",        title: "25-Year Warranty",    desc: "All repiping work is warranted for 25 years. That's how confident we are in our materials and craftsmanship." },
    { icon: "users",        title: "Local Since 2009",    desc: "We live here. We work here. We stand behind every job because our reputation depends on it." },
  ],

  faq: [
    { q: "Do you charge for emergency calls?", a: "No trip charge and no emergency surcharge. You pay the same flat rate whether we come at noon or 2am." },
    { q: "How do I know if I have a slab leak?", a: "Hot spots on your floor, unexplained water bills, or the sound of running water when everything is off are common signs. Call us — we'll diagnose it for free." },
    { q: "How long does a whole-house repipe take?", a: "Most homes in Tracy take 1–2 days. We restore water service each night so your family isn't without it." },
    { q: "Do you work on tankless water heaters?", a: "Yes — Navien, Rinnai, Bradford White, and all major brands. Repair or replacement, same-day service available." },
    { q: "Are your plumbers licensed?", a: "Every technician is a licensed journeyman or master plumber under our CSLB contractor license #445678." },
  ],

  formServiceOptions: [
    "Drain Cleaning",
    "Water Heater Repair/Replacement",
    "Leak Detection",
    "Repiping",
    "Fixture Installation",
    "Sewer Line Service",
    "Emergency Service",
  ],
}
