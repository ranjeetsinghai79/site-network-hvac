import { Nav, WhyUs, Reviews, Contact, Footer } from "@core/web"
import { config }          from "@/lib/config"
import { BarberHero }      from "@/components/barber-hero"
import { PricingSection }  from "@/components/pricing-section"
import { BarbersSection }  from "@/components/barbers-section"
import { GallerySection }  from "@/components/gallery-section"
import { StatsStrip }      from "@/components/stats-strip"

const NAV_LINKS = [
  { label: "Services", href: "#services" },
  { label: "Team",     href: "#team"     },
  { label: "Gallery",  href: "#gallery"  },
  { label: "Reviews",  href: "#reviews"  },
  { label: "Contact",  href: "#contact"  },
]

export default function Home() {
  return (
    <>
      <Nav config={config} links={NAV_LINKS} />
      <main>
        <BarberHero
          config={config}
          videoSrc={config.heroVideo}
          posterSrc="/hero-1.jpg"
        />
        <StatsStrip config={config} />
        <PricingSection config={config} />
        <BarbersSection />
        <GallerySection />
        <WhyUs config={config} />
        <Reviews
          config={config}
          ctaText={`Walk in or book — ${config.business.review_count}+ satisfied clients`}
        />
        <Contact
          config={config}
          heading="Book Your Session"
          paragraph="Walk-ins always welcome. Book online for a guaranteed slot with your preferred barber."
          submitText="Request a Booking"
        />
      </main>
      <Footer config={config} />
    </>
  )
}
