import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    name: "Northline Heating & Air",
    tagline: "Local comfort. Done right.",
    phone: "(209) 555-0147",
    phoneHref: "tel:+12095550147",
    email: "service@northlinehvac.com",
    address: "Tracy, California",
    city: "Tracy",
    serviceAreas: ["Tracy", "Mountain House", "Livermore", "Lathrop", "Manteca"],
    license: "CSLB #987654",
    since: "2012",
    google_rating: "4.9",
    review_count: "186",
    emergency: true,
    hours: "Mon–Sat, 7am–7pm · Emergency service available",
    theme: "clean",
    niche: "hvac",
  },
  about: {
    heading: "No runaround. No mystery fees.",
    body: "Straight answers before anyone touches your system. We diagnose clearly, price upfront, protect your home, and stand behind the work.",
  },
  services: [
    { icon: "snowflake", title: "AC Repair", desc: "Fast diagnosis and dependable repairs when your cooling quits.", image: "/service-1.jpg" },
    { icon: "flame", title: "Heating", desc: "Furnace and heat-pump service for cold Central Valley nights.", image: "/service-2.jpg" },
    { icon: "wrench", title: "Installation", desc: "Right-sized, high-efficiency systems installed without shortcuts.", image: "/service-3.jpg" },
    { icon: "refresh-cw", title: "Maintenance", desc: "Seasonal tune-ups that prevent breakdowns and protect efficiency.", image: "/service-4.jpg" },
  ],
  reasons: [
    { icon: "search", title: "Clear diagnosis", desc: "We show you what failed and why." },
    { icon: "dollar-sign", title: "Upfront options", desc: "You approve the price before work starts." },
    { icon: "home", title: "Respectful service", desc: "On-time arrival, protected floors, clean finish." },
    { icon: "shield-check", title: "Work we stand behind", desc: "Quality parts and a workmanship guarantee." },
  ],
  testimonials: [
    { name: "Maya R.", location: "Tracy, CA", stars: 5, text: "Our AC stopped during a 100-degree afternoon. They arrived that day and had us cooling again before dinner." },
    { name: "Daniel K.", location: "Mountain House, CA", stars: 5, text: "No pressure and no confusing upsell. Two honest options, and the bill matched the estimate." },
    { name: "Priya S.", location: "Livermore, CA", stars: 5, text: "Professional from booking to cleanup. The new system is quieter and every room finally feels comfortable." },
  ],
  stats: [
    { value: 4.9, label: "Google rating", suffix: "★", decimals: 1 },
    { value: 186, label: "Neighbor reviews", suffix: "+" },
    { value: 12, label: "Years local", suffix: "+" },
  ],
  formServiceOptions: ["AC repair", "Heating repair", "New system estimate", "Maintenance"],
}
