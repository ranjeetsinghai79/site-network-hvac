import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
  city: "Tracy",
  theme: "clean",
  niche: "daycare",
  name: "Sunshine Sprouts Learning Center",
  tagline: "Where Little Minds Grow Big.",
  phone: "(555) 901-2345",
  phoneHref: "tel:+15559012345",
  email: "hello@sunshinesprouts.com",
  address: "Tracy, California",
  serviceAreas: ["Tracy", "Mountain House", "Manteca", "Lathrop", "Banta", "Stockton"],
  license: "CA Community Care Lic #901234",
  since: "2011",
  google_rating: "5.0",
  review_count: "189",
  emergency: false,
  social: { google: "https://google.com", yelp: "https://yelp.com", facebook: "https://facebook.com" },
},

  services: [
  { icon: "baby",      image: "/service-1.jpg", title: "Infant Care",       desc: "Ages 6 weeks–18 months. Nurturing 1:3 ratios, sleep routines, tummy time, and sensory play in a safe, loving environment.", urgent: false },
  { icon: "users",     image: "/service-2.jpg", title: "Toddler Program",   desc: "Ages 18 months–3 years. Language-rich activities, social skills, and guided exploration. Daily progress photos shared.", urgent: false },
  { icon: "book-open", image: "/service-3.jpg", title: "Pre-K Curriculum",  desc: "Ages 3–5. Kindergarten readiness through play-based learning. Reading foundations, numbers, and creative arts.", urgent: false },
  { icon: "sun",       image: "/service-4.jpg", title: "After-School Care", desc: "Safe pickup from local schools. Homework help, healthy snacks, and enrichment activities until 6pm.", urgent: false },
  { icon: "calendar",  image: "/service-5.jpg", title: "Summer Camp",       desc: "Fun-packed 8-week summer program. Themes, field trips, art, science experiments, and outdoor play.", urgent: false },
  { icon: "clock",     image: "/service-6.jpg", title: "Drop-In Care",      desc: "Flexible drop-in slots available. Date night, appointment, or work meeting. Licensed, safe, no commitment.", urgent: false },
],

  about: {
    heading: "A Place Where Your Child is Always Safe, Always Growing, Always Loved",
    body: "Since 2011, Sunshine Sprouts has earned the trust of 940+ Tracy families. Our state-licensed center maintains 1:3 ratios for infants, CPR-certified teachers at every level, keypad-secured entry, and daily photo updates so parents stay connected. Our Pre-K graduates consistently test above grade level for kindergarten readiness.",
    highlights: [
      { icon: "shield",  text: "State licensed & inspected — no violations, no complaints, in good standing" },
      { icon: "heart",   text: "CPR-certified teachers — every staff member, every shift, without exception" },
      { icon: "star",    text: "Kindergarten-ready curriculum — Pre-K graduates test above grade level" },
    ],
  },

  testimonials: [
  { name: "Priya M.", location: "Tracy, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=priya_tracy_daycare", text: "My daughter cried at daycare drop-off everywhere else. First day at Sunshine Sprouts she walked right in. The teachers are incredible — she has grown so much." },
  { name: "Jason & Amy C.", location: "Mountain House, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=jason_mountainhouse_daycare", text: "Both our kids have been here since infant care. The curriculum is excellent — our son started K already reading. Safe, clean, and genuinely loving staff." },
  { name: "Fatima A.", location: "Manteca, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=fatima_manteca_daycare", text: "The daily photos and updates give me total peace of mind at work. My toddler is thriving socially and learning so fast. Worth every penny." },
],

  trustBadges: [
  "State Licensed", "Background-Checked Staff", "CPR Certified Teachers",
  "Daily Parent Updates", "Organic Snacks", "Kindergarten Readiness Curriculum"
],

  stats: [
  { value: 5,    label: "Google Rating",        suffix: "★",  decimals: 1 },
  { value: 945,  label: "Families Served",      suffix: "+",  decimals: 0 },
  { value: 15,   label: "Years Experience",     suffix: "+",  decimals: 0 },
  { value: 1,    label: "Child-to-Teacher Ratio", suffix: ":3 Infants", decimals: 0 },
],

  reasons: [
  { "icon": "heart", "title": "CPR-Certified Staff", "desc": "Every teacher and aide is current on pediatric CPR and first aid. Safety isn't optional here." },
  { "icon": "shield", "title": "Secure Check-In/Out", "desc": "Keypad entry, video monitoring, and photo ID verification. Your child cannot be picked up by anyone without authorization." },
  { "icon": "star", "title": "Daily Activity Reports", "desc": "Photos, meals, naps, and activities delivered to your phone app each day. Stay connected to every moment." },
  { "icon": "droplets", "title": "Nutritious Meals", "desc": "USDA-approved menu. Hot breakfast, lunch, and two snacks. No junk food, no exceptions." },
  { "icon": "users", "title": "Low Teacher Ratio", "desc": "Infants: 1:3. Toddlers: 1:5. Pre-K: 1:7. We don't pack rooms to cut costs." },
  { "icon": "award", "title": "Licensed & Inspected", "desc": "CA Community Care License in good standing. No violations, no complaints, no surprises." }
],

  formServiceOptions: [
  "Infant Care",
  "Toddler Program",
  "Pre-K Curriculum",
  "After-School Care",
  "Summer Camp",
  "Drop-In Care",
],

  faq: [
    {
      q: "What are your staff-to-child ratios?",
      a: "Infants (under 18 months): 1 teacher to 3 children. Toddlers: 1 to 5. Pre-K: 1 to 7. These ratios are lower than state minimums — we don't pack rooms to reduce staffing costs.",
    },
    {
      q: "How do I know my child is safe?",
      a: "Keypad-secured entry, security cameras throughout the facility, photo ID check for all pickups, and only authorized individuals on your list can pick up your child. Live camera feed available on your parent app.",
    },
    {
      q: "What does your Pre-K curriculum include?",
      a: "Our kindergarten readiness program covers phonics and early reading, number recognition, fine motor skills through art, social-emotional learning, and structured outdoor play. Most of our graduates enter K above grade level.",
    },
    {
      q: "Do you provide meals?",
      a: "Yes. We serve USDA-approved hot breakfast, lunch, and two snacks daily. No processed food or junk — menus focus on whole foods. Allergen accommodations available with advance notice.",
    },
    {
      q: "What ages do you accept?",
      a: "We care for children ages 6 weeks through 12 years — infant care, toddler program, Pre-K, and after-school care for grades K–5.",
    },
    {
      q: "Are your teachers background-checked?",
      a: "Yes. Every teacher, aide, and staff member passes a DOJ/FBI fingerprint background check, TB test, and mandatory reporter training before their first day. State-required, strictly enforced.",
    },
  ],
}

// Backward compat re-exports
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
