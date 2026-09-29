import Nav from "@/components/nav"
import Hero from "@/components/hero"
import RestaurantTicker from "@/components/restaurant-ticker"
import RestaurantStats from "@/components/restaurant-stats"
import Categories from "@/components/categories"
import Dishes from "@/components/dishes"
import About from "@/components/about"
import Specials from "@/components/specials"
import Gallery from "@/components/gallery"
import Contact from "@/components/contact"
import Footer from "@/components/footer"

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        {/* 1. Cinematic 192-frame scroll hero */}
        <Hero />

        {/* 2. Trust ticker — gold/dark theme */}
        <RestaurantTicker />

        {/* 3. Animated stats — rating, menu, buffet price, years */}
        <RestaurantStats />

        {/* 4. Category cards */}
        <Categories />

        {/* 5. Signature dishes */}
        <Dishes />

        {/* 6. About / story */}
        <About />

        {/* 7. Daily specials */}
        <Specials />

        {/* 8. Photo gallery */}
        <Gallery />

        {/* 9. Contact + hours */}
        <Contact />
      </main>
      <Footer />
    </>
  )
}
