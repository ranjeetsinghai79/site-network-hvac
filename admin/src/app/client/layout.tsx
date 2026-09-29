import "./client-brand.css"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <div data-client-brand>{children}</div>
}
