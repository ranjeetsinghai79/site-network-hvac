export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { defaultAgencyId, platformPool } from '@/lib/platform-control'

export async function GET() {
  try {
    const agencyId = await defaultAgencyId()
    const { rows: summary } = await platformPool().query(`
      SELECT aa.monthly_price_usd,aa.monthly_usage_cap_usd,
             COALESCE(SUM(ue.cost_usd) FILTER (WHERE ue.occurred_at>=date_trunc('month',now())),0) AS cost_mtd,
             COALESCE(SUM(ue.billable_usd) FILTER (WHERE ue.occurred_at>=date_trunc('month',now())),0) AS billable_mtd
      FROM agency_accounts aa LEFT JOIN usage_events ue ON ue.agency_id=aa.id WHERE aa.id=$1 GROUP BY aa.id
    `, [agencyId])
    const { rows: workspaces } = await platformPool().query(`
      SELECT gw.id,gw.business_name,gw.service_tier,COALESCE(SUM(ue.cost_usd),0) AS cost_mtd,COALESCE(SUM(ue.billable_usd),0) AS billable_mtd
      FROM growth_workspaces gw LEFT JOIN usage_events ue ON ue.workspace_id=gw.id AND ue.occurred_at>=date_trunc('month',now())
      WHERE gw.agency_id=$1 GROUP BY gw.id ORDER BY cost_mtd DESC
    `, [agencyId])
    const { rows: services } = await platformPool().query(`
      SELECT service,operation,SUM(quantity) AS quantity,SUM(cost_usd) AS cost_usd,SUM(billable_usd) AS billable_usd
      FROM usage_events WHERE agency_id=$1 AND occurred_at>=date_trunc('month',now()) GROUP BY service,operation ORDER BY cost_usd DESC
    `, [agencyId])
    return NextResponse.json({ summary: summary[0] ?? {}, workspaces, services })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
