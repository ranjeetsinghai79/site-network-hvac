import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    city: "Tracy",
    theme: "clean",
    niche: "tree-services",
    name: "TreePros of Tracy",
    tagline: "Up, Down, Gone. Done Right.",
    phone: "(555) 321-0456",
    phoneHref: "tel:+15553210456",
    email: "hello@treeprostracy.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Mountain House", "Manteca", "Stockton", "Brentwood", "Lathrop"],
    license: "CA LIC #789234",
    since: "2011",
    google_rating: "4.8",
    review_count: "389",
    emergency: true,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      facebook: "https://facebook.com",
    },
  },

  about: {
    heading: "ISA-Certified Arborists Serving Tracy Since 2011",
    body: "TreePros combines ISA-certified arborist expertise with professional-grade equipment to safely remove, trim, and care for any tree on your property. We're fully insured, carry $2M liability, and our crews work clean — stumps ground, chips hauled, yard left spotless.",
    highlights: [
      { icon: "award",       text: "ISA-certified arborists — proper diagnosis, safe removal every time" },
      { icon: "shield-check", text: "$2M liability insurance — full protection for your home and property" },
      { icon: "zap",         text: "Emergency storm damage — same-day response, 24/7 availability" },
    ],
  },

  services: [
    { icon: "zap",        image: "/service-1.jpg", title: "Tree Removal",          desc: "Safe removal of any tree, any size. Rigging, craning, precision felling. Full cleanup — logs, branches, and debris removed from property.", urgent: false },
    { icon: "scissors",   image: "/service-2.jpg", title: "Tree Trimming & Pruning", desc: "Crown reduction, dead wood removal, structural pruning. Improves tree health, appearance, and safety. ISA-certified technique on every trim.", urgent: false },
    { icon: "cloud-lightning", image: "/service-3.jpg", title: "Emergency Storm Response", desc: "Tree on your house, blocking your driveway, or hanging over power lines. We respond same-day. 24/7 emergency line.", urgent: true },
    { icon: "circle",     image: "/service-4.jpg", title: "Stump Grinding",         desc: "Stump ground to 6–12 inches below grade. Can seed or sod area same day. All grindings removed. No trace left behind.", urgent: false },
    { icon: "heart",      image: "/service-5.jpg", title: "Tree Health Care",       desc: "Deep root fertilization, disease treatment, pest management. We save trees others say need to come down. ISA-based diagnosis.", urgent: false },
    { icon: "home",       image: "/service-6.jpg", title: "Land Clearing",          desc: "Lot clearing for new construction, fire clearance zones, orchard removal. Full acreage cleared and hauled in one mobilization.", urgent: false },
  ],

  testimonials: [
    { name: "Frank M.",   location: "Tracy, CA",    stars: 5, avatar: "https://i.pravatar.cc/80?u=frank_tracy_tree",    text: "90-foot oak came down in a storm and hit my fence. TreePros was there in 4 hours, cleared everything, fixed the fence contact. Phenomenal." },
    { name: "Linda K.",   location: "Brentwood, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=linda_brentwood_tree", text: "They saved my heritage walnut tree. Two other companies said remove it. The arborist diagnosed a fungal issue, treated it, and it's thriving." },
    { name: "Carlos B.",  location: "Manteca, CA",  stars: 5, avatar: "https://i.pravatar.cc/80?u=carlos_manteca_tree",  text: "Cleared 12 trees for our pool install. Professional crew, clean site, no damage to the lawn. Took one day what I thought was a week job." },
  ],

  trustBadges: [
    "ISA Certified Arborists",
    "$2M Liability Insurance",
    "24/7 Emergency Response",
    "Free Estimates",
    "Stump Grinding Included",
    "5-Star Google Rated",
  ],

  stats: [
    { value: 4.8,  label: "Google Rating",    suffix: "★",  decimals: 1 },
    { value: 389,  label: "Trees Removed",    suffix: "+",  decimals: 0 },
    { value: 13,   label: "Years Experience", suffix: "+",  decimals: 0 },
    { value: 2,    label: "Liability Coverage", suffix: "M", decimals: 0 },
  ],

  reasons: [
    { icon: "award",        title: "ISA Certified",        desc: "Our arborists hold International Society of Arboriculture certification — highest standard in tree care." },
    { icon: "shield-check", title: "$2M Insurance",        desc: "Full $2M liability coverage. If anything goes wrong, you're completely protected. We've never had a claim." },
    { icon: "clock",        title: "Same-Day Emergency",   desc: "Storm damage doesn't wait. Our emergency line runs 24/7 and we dispatch within hours, not days." },
    { icon: "star",         title: "Clean Site Guaranteed", desc: "Every job leaves your yard cleaner than we found it. All debris, logs, chips, and grindings removed." },
    { icon: "dollar-sign",  title: "Free Written Quotes",  desc: "On-site assessment, written estimate, no obligation. Competitive pricing with no hidden mobilization fees." },
    { icon: "users",        title: "Local Since 2011",     desc: "We've been in Tracy for 13+ years. Your neighbors know us. Our work speaks for itself." },
  ],

  faq: [
    { q: "Do you remove the stump?", a: "Stump grinding is included in most removal quotes. We grind to 6–12 inches below grade and remove all grindings." },
    { q: "How quickly can you respond to storm damage?", a: "We run a 24/7 emergency line. For active emergency situations (tree on a structure), we typically respond within 2–4 hours." },
    { q: "Are you insured for large trees near my house?", a: "Yes — we carry $2M liability specifically for high-risk removals near structures. We also work with your homeowner's insurance on storm claims." },
    { q: "Do I need a permit to remove a tree in Tracy?", a: "Some heritage or protected species require permits. We handle the permitting process for you at no extra charge." },
    { q: "Can you save a sick tree instead of removing it?", a: "Our ISA arborists will always diagnose first. If the tree can be saved with treatment, we'll recommend that over removal." },
  ],

  formServiceOptions: [
    "Tree Removal",
    "Tree Trimming",
    "Emergency Storm Damage",
    "Stump Grinding",
    "Tree Health / Disease",
    "Land Clearing",
  ],
}
