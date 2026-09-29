import { cookies } from 'next/headers'
import { Pool } from '@/lib/pool'
import { verifyPlatformSession, type PlatformRole, type PlatformSession } from '@/lib/platform-session'

let _pool: InstanceType<typeof Pool> | null = null
function pool(): InstanceType<typeof Pool> {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

export interface PlatformContext extends PlatformSession {
  agencyName: string
}

export async function getPlatformContext(): Promise<PlatformContext | null> {
  const store = await cookies()
  const session = await verifyPlatformSession(store.get('agency_session')?.value)
  if (!session) return null
  const { rows } = await pool().query(`
    SELECT aa.name AS agency_name, am.role, am.status
    FROM agency_members am
    JOIN agency_accounts aa ON aa.id=am.agency_id
    WHERE am.agency_id=$1 AND lower(am.email)=lower($2) AND aa.status='active'
    LIMIT 1
  `, [session.agencyId, session.email])
  const member = rows[0]
  if (!member || member.status !== 'active' || member.role !== session.role) return null
  return { ...session, agencyName: member.agency_name }
}

export async function requirePlatformContext(roles?: PlatformRole[]): Promise<PlatformContext> {
  const context = await getPlatformContext()
  if (!context) throw new Error('UNAUTHORIZED')
  if (roles && !roles.includes(context.role)) throw new Error('FORBIDDEN')
  return context
}

export async function workspaceBelongsToAgency(workspaceId: string, agencyId: string): Promise<boolean> {
  const { rows } = await pool().query('SELECT 1 FROM growth_workspaces WHERE id=$1 AND agency_id=$2', [workspaceId, agencyId])
  return Boolean(rows[0])
}
