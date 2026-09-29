import type { Metadata } from "next"
import "./globals.css"
import { config } from "@/lib/config"
import {
  SmoothScroll,
  MagneticCursor,
  LoadingScreen,
  ScrollProgress,
} from "@core/web"
import { FAQ_SCHEMA, HOWTO_SCHEMA } from "@/lib/aeo"

const { business } = config

export const metadata: Metadata = {
  title: `${business.name} | CFP® Financial Advisors | ${business.city}, CA`,
  description: `${business.name} — ${business.tagline} Fee-only, fiduciary CFP® advisors serving ${business.serviceAreas.join(", ")}. Free 60-minute consultation. Call ${business.phone}.`,
  keywords: `financial advisor ${business.city}, CFP Tracy CA, fiduciary advisor, fee-only financial planner, retirement planning, wealth management`,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {FAQ_SCHEMA && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_SCHEMA }} />}
        {HOWTO_SCHEMA && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: HOWTO_SCHEMA }} />}
      </head>
      <body className="min-h-full flex flex-col antialiased" data-theme={business.theme}>
        <LoadingScreen name={business.name} tagline={`${business.city} · CFP® · Fiduciary`} />
        <ScrollProgress />
        <MagneticCursor />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  )
}
