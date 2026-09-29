import { config } from "@/lib/config"
import { ScrollSequenceHero } from "@core/web"
import HvacStats from "@/components/hvac-stats"
import HvacServices from "@/components/hvac-services"
import HvacContact from "@/components/hvac-contact"

export const metadata = {
  title: "Scroll Sequence Demo",
}

export default function ScrollDemoPage() {
  return (
    <main>
      <ScrollSequenceHero
        frameCount={79}
        headline="From breakdown to breathing easy"
        subline="Scroll through the fix — frame by frame"
      />
      <HvacStats config={config} />
      <HvacServices config={config} />
      <HvacContact config={config} />
    </main>
  )
}
