import { Nav, Hero, ScrollHero, Reviews, Contact, Footer } from "@core/web"
import { config } from "@/lib/config"
import StatsSection from "@/components/stats-section"
import PropertiesSection from "@/components/properties-section"
import AboutSection from "@/components/about-section"

export default function Home() {
  const isPremium = config.tier === "premium"
  return (
    <>
      <Nav
        config={config}
        scrolledTheme="dark"
        links={[
          { label: "Properties", href: "#properties" },
          { label: "About", href: "#about" },
          { label: "Reviews", href: "#reviews" },
          { label: "Contact", href: "#contact" },
        ]}
        cta={
          <>
            {config.business.whatsapp && (
              <a href={config.business.whatsapp} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-2.5 px-5">
                WhatsApp
              </a>
            )}
            <a href="#contact" className="btn-primary text-xs py-2.5 px-5">Schedule Viewing</a>
          </>
        }
      />
      <main>
        {isPremium
          ? <ScrollHero config={config} videoSrc="/hero-bg.mp4" posterSrc="/hero-1.jpg" />
          : <Hero
              config={config}
              posterSrc="/hero-1.jpg"
              label={`${config.business.city} · Premium Properties`}
              badge="Exclusive Listings Available Now"
              paragraph={`Curated luxury properties across ${config.business.serviceAreas.slice(0, 3).join(", ")} and beyond. Investment-grade real estate with unmatched market expertise.`}
              ctaSlot={
                <>
                  <a href="#properties" className="btn-primary">Explore Properties</a>
                  <a href="#contact" className="btn-ghost">Schedule Private Viewing</a>
                </>
              }
            />
        }
        <StatsSection />
        <PropertiesSection />
        <AboutSection />
        <Reviews config={config} label="Client Voices" heading="What Our Clients Say" />
        <Contact
          config={config}
          label="Get in Touch"
          heading="Schedule Your Private Viewing"
          paragraph="Our consultants are available 7 days a week. Whether you're a first-time buyer, seasoned investor, or relocating executive — we tailor every engagement to your goals."
          submitText="Request Consultation"
        />
      </main>
      <Footer config={config} />
    </>
  )
}
