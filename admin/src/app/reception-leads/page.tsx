export const runtime = 'edge'
import { getReceptionCallLogs, getReceptionConfigOptions } from "@/lib/db"
import { ReceptionCallsTable } from "@/components/reception-calls-table"

export const dynamic = "force-dynamic"

export default async function ReceptionLeadsPage() {
  const [calls, configs] = await Promise.all([
    getReceptionCallLogs(),
    getReceptionConfigOptions(),
  ])

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize:      22,
            fontWeight:    800,
            letterSpacing: "-0.03em",
            color:         "var(--text)",
          }}
        >
          Reception Calls
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
          {calls.length} calls across {configs.length} demo lines · every inbound call, transcript, and captured prospect
        </p>
      </div>
      <ReceptionCallsTable calls={calls} configs={configs} />
    </div>
  )
}
