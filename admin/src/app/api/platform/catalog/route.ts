export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { auditPlatform, defaultAgencyId, platformPool } from '@/lib/platform-control'

export async function GET() {
  try {
    const agencyId = await defaultAgencyId()
    const [agents, playbooks, submissions] = await Promise.all([
      platformPool().query(`SELECT * FROM agent_definitions WHERE status='active' ORDER BY category,name`),
      platformPool().query(`SELECT * FROM playbook_templates WHERE status='active' ORDER BY niche,name`),
      platformPool().query(`SELECT * FROM catalog_submissions WHERE agency_id=$1 OR status='approved' ORDER BY created_at DESC LIMIT 200`, [agencyId]),
    ])
    return NextResponse.json({ agents: agents.rows, playbooks: playbooks.rows, submissions: submissions.rows })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const agencyId = await defaultAgencyId()
    const body = await request.json()
    if (!['agent','playbook','integration'].includes(body.artifactType) || !body.name || !body.description) return NextResponse.json({ error: 'artifactType, name, and description required' }, { status: 400 })
    const { rows } = await platformPool().query(`
      INSERT INTO catalog_submissions (agency_id,submitted_by,artifact_type,artifact_id,name,description,manifest,commercial_terms)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [agencyId, String(body.actorEmail ?? 'admin@webcrew.app'), body.artifactType, body.artifactId ?? null, body.name, body.description, JSON.stringify(body.manifest ?? {}), JSON.stringify(body.commercialTerms ?? {})])
    return NextResponse.json({ submission: rows[0] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  let client: any = null
  try {
    const agencyId = await defaultAgencyId()
    const body = await request.json()
    if (!body.submissionId || !['approved','rejected','changes_requested','suspended'].includes(body.status)) return NextResponse.json({ error: 'Invalid review action' }, { status: 400 })
    client = await platformPool().connect()
    await client.query('BEGIN')
    const { rows } = await client.query(`
      UPDATE catalog_submissions SET status=$2,reviewed_by=$3,reviewed_at=now(),review_notes=$4,security_review=$5,updated_at=now()
      WHERE id=$1 RETURNING *
    `, [body.submissionId, body.status, String(body.actorEmail ?? 'admin@webcrew.app'), body.reviewNotes ?? null, JSON.stringify(body.securityReview ?? {})])
    if (!rows[0]) throw new Error('Submission not found')
    const submission = rows[0]
    if (body.status === 'approved') {
      const slug = String(submission.artifact_id ?? submission.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)
      if (submission.artifact_type === 'agent') {
        await client.query(`
          INSERT INTO agent_definitions (id,name,category,description,version,risk_level,default_requires_approval,capabilities,status,publisher_agency_id,visibility,pricing_model,price_usd)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,'catalog',$10,$11)
          ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,version=EXCLUDED.version,capabilities=EXCLUDED.capabilities,status='active',visibility='catalog',updated_at=now()
        `, [slug,submission.name,submission.manifest?.category??'partner',submission.description,submission.manifest?.version??'1.0.0',submission.manifest?.riskLevel??'high',submission.manifest?.requiresApproval!==false,JSON.stringify(submission.manifest?.capabilities??[]),submission.agency_id,submission.commercial_terms?.pricingModel??'included',Number(submission.commercial_terms?.priceUsd??0)])
      } else if (submission.artifact_type === 'playbook') {
        await client.query(`
          INSERT INTO playbook_templates (id,name,niche,version,description,definition,status,publisher_agency_id,visibility)
          VALUES ($1,$2,$3,$4,$5,$6,'active',$7,'catalog')
          ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,version=EXCLUDED.version,definition=EXCLUDED.definition,status='active',visibility='catalog',updated_at=now()
        `, [slug,submission.name,submission.manifest?.niche??'local_business',submission.manifest?.version??'1.0.0',submission.description,JSON.stringify(submission.manifest?.definition??{agents:[]}),submission.agency_id])
      }
    }
    await client.query('COMMIT')
    client.release(); client = null
    await auditPlatform({ agencyId, actorEmail: String(body.actorEmail ?? 'admin@webcrew.app'), action: `catalog.${body.status}`, entityType: 'catalog_submission', entityId: body.submissionId })
    return NextResponse.json({ submission: rows[0] })
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {})
      client.release()
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
