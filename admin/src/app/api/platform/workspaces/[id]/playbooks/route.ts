export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { auditPlatform, defaultAgencyId, platformPool } from '@/lib/platform-control'

export async function GET(_:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{const{id}=await params;const agencyId=await defaultAgencyId();const{rows}=await platformPool().query(`
    SELECT pt.id,pt.name,pt.niche,pt.version,pt.description,pt.definition,
           COALESCE(wpi.status='installed',false) AS installed
    FROM playbook_templates pt JOIN growth_workspaces gw ON gw.id=$1 AND gw.agency_id=$2
    LEFT JOIN workspace_playbook_installations wpi ON wpi.workspace_id=gw.id AND wpi.playbook_id=pt.id
    WHERE pt.status='active' ORDER BY pt.niche,pt.name`,[id,agencyId]);return NextResponse.json({playbooks:rows})
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:500})}
}

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const client=await platformPool().connect()
  try{const{id}=await params;const agencyId=await defaultAgencyId();const body=await request.json();await client.query('BEGIN')
    const workspace=await client.query(`SELECT id FROM growth_workspaces WHERE id=$1 AND agency_id=$2 FOR UPDATE`,[id,agencyId]);if(!workspace.rows[0])throw new Error('Workspace not found')
    if(body.enabled){
      await client.query(`INSERT INTO workspace_playbook_installations (workspace_id,playbook_id,status,installed_by) SELECT $1,id,'installed',$3 FROM playbook_templates WHERE id=$2 AND status='active' ON CONFLICT (workspace_id,playbook_id) DO UPDATE SET status='installed',updated_at=now()`,[id,body.playbookId,String(body.actorEmail??'admin@webcrew.app')])
      const playbook=await client.query(`SELECT definition FROM playbook_templates WHERE id=$1`,[body.playbookId]);const agents=Array.isArray(playbook.rows[0]?.definition?.agents)?playbook.rows[0].definition.agents:[]
      for(const agentId of agents)await client.query(`INSERT INTO workspace_agent_installations (workspace_id,agent_id,enabled,autonomy_level,installed_by) SELECT $1,id,true,CASE WHEN risk_level='low' THEN 2 ELSE 1 END,$3 FROM agent_definitions WHERE id=$2 ON CONFLICT (workspace_id,agent_id) DO UPDATE SET enabled=true,updated_at=now()`,[id,agentId,String(body.actorEmail??'admin@webcrew.app')])
    }else await client.query(`UPDATE workspace_playbook_installations SET status='disabled',updated_at=now() WHERE workspace_id=$1 AND playbook_id=$2`,[id,body.playbookId])
    await client.query('COMMIT');await auditPlatform({agencyId,workspaceId:id,actorEmail:String(body.actorEmail??'admin@webcrew.app'),action:body.enabled?'playbook.installed':'playbook.disabled',entityType:'playbook',entityId:body.playbookId});return NextResponse.json({ok:true})
  }catch(error){await client.query('ROLLBACK');return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:400})}finally{client.release()}
}
