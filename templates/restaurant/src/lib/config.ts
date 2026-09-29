import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    name: "Minerva Grand",
    tagline: "Authentic Indian Cuisine",
    phone: "(209) 555-0182",
    phoneHref: "tel:+12095550182",
    email: "reservations@minervagrand.com",
    address: "2450 W. Grant Line Rd, Tracy, CA 95376",
    city: "Tracy",
    serviceAreas: ["Tracy", "Stockton", "Manteca", "Lathrop", "Mountain House"],
    since: "2012",
    google_rating: "4.8",
    review_count: "620",
    social: {
      instagram: "https://instagram.com",
      facebook:  "https://facebook.com",
      yelp:      "https://yelp.com",
    },
    theme: "ember",
    niche: "restaurant",
  },

  about: {
    heading: "Twelve Years of Authentic Indian Flavor in the Central Valley",
    body: "Minerva Grand was born from a family recipe book and a belief that great Indian food shouldn't require a 90-minute drive to the Bay Area. Since 2012 we've been serving Tracy with slow-cooked biryanis, tandoor-fired breads, and weekend buffets that keep the dining room packed. Every dish starts with whole spices, fresh herbs, and the same recipes we've used for a decade.",
    highlights: [
      { icon: "star",        text: "4.8 Google rating across 620+ verified reviews" },
      { icon: "users",       text: "Family-owned and operated since 2012" },
      { icon: "clock",       text: "$9.99 Wednesday Biryani Special · $17.99 Weekend Buffet" },
    ],
  },

  services: [
    { icon: "utensils",    image: "/service-1.jpg", title: "Dine-In",         desc: "Seat up to 120 guests in our warm, candlelit dining room. Full bar, curated cocktail menu, and a dedicated sommelier on weekends." },
    { icon: "shopping-bag", image: "/service-2.jpg", title: "Takeout & Delivery", desc: "Online ordering available 7 days a week. Pickup in 20 minutes or delivery via DoorDash and Uber Eats within 8 miles." },
    { icon: "calendar",    image: "/service-3.jpg", title: "Private Events",   desc: "Full venue buyout or private dining room for 20–50. Custom menus, AV setup, and dedicated event coordinator included." },
    { icon: "gift",        image: "/service-4.jpg", title: "Catering",         desc: "Off-site catering for corporate lunches, weddings, and milestone celebrations. Hot-hold chafing setups or plated service — your choice." },
    { icon: "coffee",      image: "/service-5.jpg", title: "Weekend Buffet",   desc: "Over 40 dishes every Saturday and Sunday, 11:30 AM to 3 PM. Adults $17.99 · Kids under 10 free. Reservations recommended." },
    { icon: "heart",       image: "/service-6.jpg", title: "Loyalty Rewards",  desc: "Earn points on every visit. Every 10th dine-in meal is on us. Ask your server or sign up at the front desk." },
  ],

  testimonials: [
    { name: "Priya M.",  location: "Tracy, CA",    stars: 5, avatar: "https://i.pravatar.cc/80?u=priya_tracy_rest",    text: "Best biryani outside of Hyderabad. The dum cooking method is authentic — you can smell the saffron before the dish even reaches the table." },
    { name: "Kevin L.",  location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=kevin_stockton_rest", text: "We book the private room for every company event now. The lamb rogan josh never disappoints and the staff treat our clients like family." },
    { name: "Sonal P.",  location: "Manteca, CA",  stars: 5, avatar: "https://i.pravatar.cc/80?u=sonal_manteca_rest",  text: "The weekend buffet is a ritual for us. $17.99 for 40+ dishes — there is no better deal in the Central Valley, period." },
  ],

  trustBadges: [
    "Open 7 Days",
    "4.8★ Google Rated",
    "Halal Certified",
    "Private Events",
    "Online Ordering",
    "Catering Available",
  ],

  stats: [
    { value: "200+",   label: "Menu Items" },
    { value: "4.8",    label: "Google Rating" },
    { value: "620+",   label: "Reviews" },
    { value: "12",     label: "Years Serving Tracy" },
  ],

  faq: [
    { q: "Do you take reservations?", a: "Yes — online via OpenTable or call us directly. Walk-ins always welcome, but we recommend reserving on Friday and Saturday evenings." },
    { q: "Is the food halal?", a: "All of our meat is certified halal. We're happy to confirm the sourcing — just ask your server." },
    { q: "Do you offer vegan and gluten-free options?", a: "Yes. Our menu is clearly labeled. Over 30 dishes are naturally vegan or can be prepared vegan on request." },
    { q: "Can I book the restaurant for a private event?", a: "Absolutely. We offer a private dining room (up to 50 guests) and full venue buyout. Contact us at reservations@minervagrand.com for custom quotes." },
    { q: "What are your hours?", a: "Mon–Thu 11:30 AM – 9:30 PM · Fri–Sat 11:30 AM – 10:30 PM · Sun 11:30 AM – 9:30 PM" },
  ],

  formServiceOptions: [
    "Dine-In Reservation",
    "Private Event",
    "Corporate Catering",
    "Wedding Catering",
    "Takeout Order",
    "Weekend Buffet",
  ],
}
