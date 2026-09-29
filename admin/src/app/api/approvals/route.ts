export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "@/lib/pool"

let _pool: InstanceType<typeof Pool> | null = null
function pool(): InstanceType<typeof Pool> {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

const TABLES: Record<string, { table: string; idType: "uuid" | "text" }> = {
  social: { table: "social_assets", idType: "uuid" },
  ad:     { table: "ad_campaign_drafts", idType: "uuid" },
  video:  { table: "video_assets", idType: "uuid" },
  task:   { table: "growth_agent_tasks", idType: "text" },
  run:    { table: "automation_runs", idType: "uuid" },
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const entityType = String(body.entityType ?? "")
    const entityId = String(body.entityId ?? "")
    const action = String(body.action ?? "")
    const actorEmail = body.actorEmail ? String(body.actorEmail) : null
    const notes = body.notes ? String(body.notes) : null

    if (!TABLES[entityType]) return NextResponse.json({ error: "invalid entityType" }, { status: 400 })
    if (!entityId) return NextResponse.json({ error: "entityId required" }, { status: 400 })
    if (!["approve", "reject"].includes(action)) return NextResponse.json({ error: "invalid action" }, { status: 400 })

    const target = TABLES[entityType]
    const status = action === "approve" ? "approved" : "rejected"
    const idCast = target.idType === "uuid" ? "$2::uuid" : "$2"

    const client = await pool().connect()
    try {
      await client.query("BEGIN")
      if (entityType !== "run") {
        await client.query(`UPDATE ${target.table} SET status=$1, updated_at=NOW() WHERE id=${idCast}`, [status, entityId])
      }

      if (entityType === "ad" && action === "approve") {
        await client.query(
          `UPDATE ad_campaign_drafts
           SET approved_by=$1, approved_at=NOW()
           WHERE id=$2::uuid`,
          [actorEmail, entityId]
        )
      }

      if (entityType === "video" && action === "approve") {
        await client.query(
          `UPDATE video_assets
           SET approved_by=$1, approved_at=NOW()
           WHERE id=$2::uuid`,
          [actorEmail, entityId]
        )
      }

      const workspaceResult = await client.query(
        entityType === "run"
          ? `SELECT workspace_id FROM automation_runs WHERE id=$1::uuid`
          : entityType === "task"
            ? `SELECT workspace_id FROM growth_agent_tasks WHERE id=$1`
            : `SELECT workspace_id FROM ${target.table} WHERE id=$1::uuid`,
        [entityId]
      )
      const event = await client.query(
        `INSERT INTO approval_events (workspace_id, entity_type, entity_id, action, actor_email, notes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [workspaceResult.rows[0]?.workspace_id ?? null, entityType, entityId, action, actorEmail, notes]
      )
      if (entityType === "run") {
        await client.query(
          `UPDATE automation_runs SET status=$1,approval_event_id=$2,updated_at=now(),next_attempt_at=now()
           WHERE id=$3::uuid`,
          [action === "approve" ? "queued" : "rejected", event.rows[0].id, entityId]
        )
      }

      await client.query("COMMIT")
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }

    return NextResponse.json({ ok: true, entityType, entityId, status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
