export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { defaultAgencyId, platformPool } from '@/lib/platform-control'

export async function GET() {
  try {
    const agencyId = await defaultAgencyId()
    const [logs, counts] = await Promise.all([
      platformPool().query(`SELECT * FROM security_audit_log WHERE agency_id=$1 ORDER BY created_at DESC LIMIT 200`, [agencyId]),
      platformPool().query(`
        SELECT
          (SELECT COUNT(*) FROM agency_members WHERE agency_id=$1 AND status='active') AS active_members,
          (SELECT COUNT(*) FROM platform_invites WHERE agency_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()) AS open_invites,
          (SELECT COUNT(*) FROM automation_runs ar JOIN growth_workspaces gw ON gw.id=ar.workspace_id WHERE gw.agency_id=$1 AND ar.status='failed') AS failed_runs,
          (SELECT COUNT(*) FROM workspace_integrations WHERE agency_id=$1 AND status='error') AS integration_errors
      `, [agencyId]),
    ])
    return NextResponse.json({ summary: counts.rows[0], logs: logs.rows })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
