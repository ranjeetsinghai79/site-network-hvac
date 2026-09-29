export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createInvite, platformPool } from '@/lib/platform-control'

export async function GET() {
  try {
    const { rows } = await platformPool().query(`
      SELECT aa.id,aa.name,aa.slug,aa.status,aa.plan,aa.monthly_price_usd,aa.monthly_usage_cap_usd,
             COUNT(DISTINCT am.id) AS members,COUNT(DISTINCT gw.id) AS workspaces
      FROM agency_accounts aa LEFT JOIN agency_members am ON am.agency_id=aa.id LEFT JOIN growth_workspaces gw ON gw.agency_id=aa.id
      GROUP BY aa.id ORDER BY aa.created_at
    `)
    return NextResponse.json({ agencies: rows })
  } catch (error) { return NextResponse.json({ error: error instanceof Error?error.message:String(error) },{status:500}) }
}

export async function POST(request: NextRequest) {
  try {
    const body=await request.json();const name=String(body.name??'').trim();const ownerEmail=String(body.ownerEmail??'').trim().toLowerCase();
    if(!name||!ownerEmail.includes('@'))return NextResponse.json({error:'Agency name and owner email required'},{status:400})
    const slugBase=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'agency'
    const {rows}=await platformPool().query(`INSERT INTO agency_accounts (name,slug,status,plan,monthly_price_usd,monthly_usage_cap_usd,billing_email) VALUES ($1,$2||'-'||substr(gen_random_uuid()::text,1,6),'active','private_beta',$3,$4,$5) RETURNING *`,[name,slugBase,Number(body.monthlyPriceUsd??0),Number(body.monthlyUsageCapUsd??250),ownerEmail])
    const invite=await createInvite({agencyId:rows[0].id,actorEmail:String(body.actorEmail??'admin@webcrew.app'),email:ownerEmail,role:'owner'})
    const base=process.env.NEXT_PUBLIC_URL??'http://localhost:3010';const inviteUrl=`${base}/agency/auth/${invite.token}`
    if(process.env.RESEND_API_KEY)await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.OUTREACH_FROM_EMAIL??'WebCrew <noreply@webcrew.app>',to:ownerEmail,subject:'Your WebCrew agency platform invitation',html:`<p>Your agency workspace is ready.</p><p><a href="${inviteUrl}">Accept owner invitation</a></p>`})})
    return NextResponse.json({agency:rows[0],...(process.env.NODE_ENV!=='production'?{inviteUrl}:{})},{status:201})
  } catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:400})}
}
