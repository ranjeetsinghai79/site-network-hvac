export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformContext } from '@/lib/platform-auth'
import { auditPlatform, platformPool } from '@/lib/platform-control'

export async function GET() {
  try {
    const context=await requirePlatformContext()
    const [agents,playbooks,submissions]=await Promise.all([
      platformPool().query(`SELECT id,name,category,description,version,risk_level,pricing_model,price_usd FROM agent_definitions WHERE status='active' AND (visibility='catalog' OR publisher_agency_id=$1) ORDER BY category,name`,[context.agencyId]),
      platformPool().query(`SELECT id,name,niche,description,version FROM playbook_templates WHERE status='active' AND (visibility='catalog' OR publisher_agency_id=$1) ORDER BY niche,name`,[context.agencyId]),
      platformPool().query(`SELECT * FROM catalog_submissions WHERE agency_id=$1 ORDER BY created_at DESC`,[context.agencyId]),
    ])
    return NextResponse.json({agents:agents.rows,playbooks:playbooks.rows,submissions:submissions.rows})
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:401})}
}

export async function POST(request:NextRequest){
  try{
    const context=await requirePlatformContext(['owner','operator','specialist']);const body=await request.json()
    if(!['agent','playbook','integration'].includes(body.artifactType)||!body.name||!body.description)return NextResponse.json({error:'Type, name, and description required'},{status:400})
    const {rows}=await platformPool().query(`INSERT INTO catalog_submissions (agency_id,submitted_by,artifact_type,artifact_id,name,description,manifest,commercial_terms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[context.agencyId,context.email,body.artifactType,body.artifactId??null,body.name,body.description,JSON.stringify(body.manifest??{}),JSON.stringify(body.commercialTerms??{})])
    await auditPlatform({agencyId:context.agencyId,actorEmail:context.email,actorRole:context.role,action:'catalog.submitted',entityType:'catalog_submission',entityId:rows[0].id})
    return NextResponse.json({submission:rows[0]},{status:201})
  }catch(error){const message=error instanceof Error?error.message:String(error);return NextResponse.json({error:message},{status:message==='FORBIDDEN'?403:message==='UNAUTHORIZED'?401:400})}
}
