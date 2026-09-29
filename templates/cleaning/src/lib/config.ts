import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
  city: "Tracy",
  theme: "clean",
  niche: "cleaning",
  name: "Sparkle Clean Co.",
  tagline: "Spotless Home. Zero Stress.",
  phone: "(555) 789-0123",
  phoneHref: "tel:+15557890123",
  email: "hello@sparkleclean.com",
  address: "Tracy, California",
  serviceAreas: ["Tracy", "Stockton", "Manteca", "Lathrop", "Mountain House", "Ripon"],
  license: "CA Business #789012",
  since: "2012",
  google_rating: "4.9",
  review_count: "523",
  emergency: false,
  social: { google: "https://google.com", yelp: "https://yelp.com", facebook: "https://facebook.com" },
},

  services: [
  { icon: "sparkles", image: "/service-1.jpg", title: "Deep Cleaning", desc: "One-time top-to-bottom clean. Perfect for move-in/out, post-construction, or a seasonal fresh start. We leave no corner untouched.", urgent: false },
  { icon: "calendar", image: "/service-2.jpg", title: "Weekly / Bi-Weekly", desc: "Recurring cleaning on your schedule. Same trusted cleaner every visit. Cancel anytime, no contracts.", urgent: false },
  { icon: "truck",    image: "/service-3.jpg", title: "Move In / Move Out", desc: "Professional clean for your old place or new home. Deposit-back guaranteed or we re-clean free.", urgent: false },
  { icon: "building", image: "/service-4.jpg", title: "Commercial Cleaning", desc: "Offices, retail spaces, medical facilities. Nightly, weekly, or custom schedule. Bonded and insured.", urgent: false },
  { icon: "home",     image: "/service-5.jpg", title: "Post-Construction", desc: "Dust, debris, paint overspray — we handle it all. Move-in ready within 24 hours of construction.", urgent: false },
  { icon: "key",      image: "/service-6.jpg", title: "Airbnb Turnover", desc: "Between-guest cleaning that earns 5-star reviews. Quick turnaround. Fresh linens. Restock supplies.", urgent: false },
],

  about: {
    heading: "The Last Cleaning Company You'll Ever Need",
    body: "Since 2012, Sparkle Clean has handled over 2,600 cleans across Tracy and the surrounding areas. Background-checked team, eco-friendly products, and a satisfaction guarantee that actually means something: not happy? We come back within 24 hours and re-clean it free — no questions asked. Book online in 60 seconds.",
    highlights: [
      { icon: "shield",      text: "Background-checked cleaners — thorough checks before anyone enters your home" },
      { icon: "droplets",    text: "Eco-friendly products — non-toxic, biodegradable, safe for kids and pets" },
      { icon: "thumbs-up",   text: "100% satisfaction guarantee — not happy? Re-clean within 24 hours, free" },
    ],
  },

  testimonials: [
  { name: "Michelle B.", location: "Tracy, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=michelle_tracy_cleaning", text: "My house has never been this clean. The team arrived on time, worked methodically, and even cleaned spots I didn't ask for. Subscribing immediately." },
  { name: "David S.", location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=david_stockton_cleaning", text: "Used them for move-out cleaning. Landlord returned the full deposit with a compliment about the condition. Worth every dollar." },
  { name: "Airbnb Host A.", location: "Manteca, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=airbnb_manteca_cleaning", text: "They turn my unit over in 2 hours no matter the condition. Guests consistently give 5 stars for cleanliness. Best business decision I made." },
],

  trustBadges: [
  "Background-Checked Staff", "Fully Insured", "Eco-Friendly Products",
  "Satisfaction Guarantee", "No Contracts", "5-Star Average"
],

  stats: [
  { value: 4.9,  label: "Google Rating",        suffix: "★",  decimals: 1 },
  { value: 2615, label: "Cleans Completed",     suffix: "+",  decimals: 0 },
  { value: 14,   label: "Years Experience",     suffix: "+",  decimals: 0 },
  { value: 24,   label: "Re-Clean Guarantee",   suffix: "h",  decimals: 0 },
],

  reasons: [
  { "icon": "droplets", "title": "Eco-Friendly Products", "desc": "Non-toxic, biodegradable cleaners. Safe for your kids, pets, and the planet." },
  { "icon": "shield", "title": "Background-Checked Team", "desc": "Every cleaner passes a thorough background check and in-person interview before entering a client's home." },
  { "icon": "thumbs-up", "title": "Satisfaction Guarantee", "desc": "Not happy with something? We come back within 24 hours and re-clean it free. No arguments." },
  { "icon": "clock", "title": "Flexible Scheduling", "desc": "Weekly, bi-weekly, monthly, or one-time. Morning, afternoon, or evening — we work around your life." },
  { "icon": "award", "title": "Bonded & Insured", "desc": "Full liability coverage and worker's comp. You're protected if anything goes wrong." },
  { "icon": "star", "title": "Online Booking", "desc": "Book in 60 seconds from your phone. No phone tag, no voicemail — instant confirmation." }
],

  formServiceOptions: [
  "Deep Cleaning",
  "Weekly / Bi-Weekly",
  "Move In / Move Out",
  "Commercial Cleaning",
  "Post-Construction",
  "Airbnb Turnover",
],

  faq: [
    {
      q: "Do I need to be home during the cleaning?",
      a: "No. Most clients give us a key or door code and come home to a clean house. All cleaners are background-checked and bonded. Your home and belongings are fully covered while we're there.",
    },
    {
      q: "What if something gets broken or damaged?",
      a: "We're fully bonded and insured. Report any damage within 24 hours and we'll handle it through our insurance — no hassle, no arguments.",
    },
    {
      q: "Do you bring your own supplies?",
      a: "Yes. We bring all cleaning equipment and eco-friendly products. If you'd like us to use specific products you provide, just leave them out and we'll use yours.",
    },
    {
      q: "How do I cancel or reschedule?",
      a: "No contracts, no cancellation fees. Just give us 24 hours notice and we'll reschedule with no penalty. We earn your business every visit.",
    },
    {
      q: "How much does a cleaning cost?",
      a: "Deep clean for a 3BR/2BA home typically runs $180–$250. Recurring bi-weekly service starts at $130–$160 per visit. Move-out cleans vary by condition. Call or book online for an instant quote.",
    },
    {
      q: "Do you do background checks on all employees?",
      a: "Yes. Every team member passes a criminal background check, reference check, and in-person interview before their first shift. You'll always know who's coming to your home.",
    },
  ],
}

// Backward compat re-exports
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
