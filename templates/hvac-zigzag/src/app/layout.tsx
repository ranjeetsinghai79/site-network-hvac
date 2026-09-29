import type { Metadata } from "next"
import "./globals.css"
import { config } from "@/lib/config"
import { SmoothScroll, ScrollProgress, LoadingScreen, MagneticCursor } from "@core/web"
import { FAQ_SCHEMA, HOWTO_SCHEMA } from "@/lib/aeo"

const { business } = config

export const metadata: Metadata = {
  title: `${business.name} | ${business.address}`,
  description: `${business.name} — Licensed HVAC & Plumbing serving ${business.serviceAreas.join(", ")}. 24/7 emergency service. Call ${business.phone}.`,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {FAQ_SCHEMA && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_SCHEMA }} />}
        {HOWTO_SCHEMA && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: HOWTO_SCHEMA }} />}
      </head>
      <body
        className="min-h-full flex flex-col antialiased"
        data-theme={business.theme}
      >
        <LoadingScreen name={business.name} tagline={`${business.serviceAreas[0]} · Licensed & Insured`} />
        <ScrollProgress />
        <MagneticCursor />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  )
}
