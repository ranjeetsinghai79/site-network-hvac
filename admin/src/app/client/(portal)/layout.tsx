export const runtime = 'edge'
import { loadPortal } from "@/lib/client-portal"
import { ClientNav } from "@/components/client-nav"

export const dynamic = "force-dynamic"

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const p = await loadPortal()
  return (
    <>
      <ClientNav
        business={p.lead.name}
        email={p.email}
        hasReception={!!p.reception}
        hasSite={p.hasSite}
        needsCallback={p.nav.needsCallback}
        setupIncomplete={!!p.reception && !p.setup.done}
      />
      <main className="portal-main"><div className="portal-content">{children}</div></main>
    </>
  )
}
