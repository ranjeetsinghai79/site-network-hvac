export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { auditPlatform, defaultAgencyId, platformPool } from '@/lib/platform-control'

const allowedSettings=new Set(['customerId','loginCustomerId','adAccountId','pageId','authorUrn'])
const oauthProviders=new Set(['google_ads','meta_ads','instagram_ads','facebook_page','instagram','threads'])

export async function GET(_:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{const{id}=await params;const agencyId=await defaultAgencyId();const{rows}=await platformPool().query(`SELECT wi.provider,wi.status,wi.account_label,wi.metadata,wi.last_checked_at,wi.error FROM workspace_integrations wi JOIN growth_workspaces gw ON gw.id=wi.workspace_id WHERE wi.workspace_id=$1 AND gw.agency_id=$2 ORDER BY wi.provider`,[id,agencyId]);return NextResponse.json({integrations:rows.map(row=>({...row,connectUrl:oauthProviders.has(row.provider)?`/api/integrations/${row.provider}/start?workspaceId=${id}`:null}))})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:500})}
}

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{const{id}=await params;const agencyId=await defaultAgencyId();const body=await request.json();const settings=Object.fromEntries(Object.entries(body.settings??{}).filter(([key,value])=>allowedSettings.has(key)&&typeof value==='string'&&value.length<200));const{rows}=await platformPool().query(`UPDATE workspace_integrations wi SET metadata=metadata||$4::jsonb,updated_at=now() FROM growth_workspaces gw WHERE wi.workspace_id=$1 AND wi.provider=$2 AND gw.id=wi.workspace_id AND gw.agency_id=$3 RETURNING wi.provider,wi.status,wi.metadata`,[id,body.provider,agencyId,JSON.stringify(settings)]);if(!rows[0])return NextResponse.json({error:'Integration not found'},{status:404});await auditPlatform({agencyId,workspaceId:id,actorEmail:String(body.actorEmail??'admin@webcrew.app'),action:'integration.settings_updated',entityType:'workspace_integration',entityId:body.provider,metadata:{keys:Object.keys(settings)}});return NextResponse.json({integration:rows[0]})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:400})}
}
