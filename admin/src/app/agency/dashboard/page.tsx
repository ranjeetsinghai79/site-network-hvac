"use client"

import { useEffect, useState } from 'react'
import { Building2, CheckCircle2, Clock3, DollarSign, LogOut, Plus } from 'lucide-react'

type Data = { context: { agencyName: string; email: string; role: string }; workspaces: any[]; reports: any[]; usage: any; pendingApprovals: number; integrations:any[] }

export default function AgencyDashboardPage() {
  const [data, setData] = useState<Data | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [approvals, setApprovals] = useState<any[]>([])
  const [catalog, setCatalog] = useState<any>({ submissions: [] })
  const [catalogName, setCatalogName] = useState('')
  const [catalogDescription, setCatalogDescription] = useState('')
  const [url, setUrl] = useState('')
  const [niche, setNiche] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function load() {
    const [dashboard, onboarding, approvalResponse, catalogResponse] = await Promise.all([fetch('/api/platform/self/dashboard'), fetch('/api/platform/self/onboarding'), fetch('/api/platform/self/approvals'), fetch('/api/platform/self/catalog')])
    if (dashboard.status === 401) { window.location.href = '/agency/login'; return }
    setData(await dashboard.json()); setSessions((await onboarding.json()).sessions ?? []); setApprovals((await approvalResponse.json()).approvals ?? []); setCatalog(await catalogResponse.json())
  }
  useEffect(() => { load() }, [])
  async function onboard(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('Reading the business website...')
    const response = await fetch('/api/platform/self/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ websiteUrl: url, niche }) })
    const result = await response.json(); setMessage(response.ok ? 'Business DNA is ready for review.' : result.error); setBusy(false); if (response.ok) { setUrl(''); await load() }
  }
  async function confirm(id: string) {
    setBusy(true); const response = await fetch(`/api/platform/self/onboarding/${id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const result = await response.json(); setMessage(response.ok ? 'Client workspace provisioned.' : result.error); setBusy(false); await load()
  }
  async function decide(runId:string,action:'approve'|'reject') { setBusy(true); const response=await fetch('/api/platform/self/approvals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId,action})}); const result=await response.json(); setMessage(response.ok?`Automation ${action}d.`:result.error); setBusy(false); await load() }
  async function submitCatalog(event:React.FormEvent) { event.preventDefault(); setBusy(true); const response=await fetch('/api/platform/self/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({artifactType:'agent',name:catalogName,description:catalogDescription})}); const result=await response.json(); setMessage(response.ok?'Agent submitted for platform review.':result.error); if(response.ok){setCatalogName('');setCatalogDescription('')} setBusy(false); await load() }
  if (!data) return <div style={{ padding: 32, color: '#94a3b8' }}>Loading agency platform...</div>
  return <main style={{ minHeight: '100vh', background: '#07070f', color: '#e2e8f0' }}>
    <header style={{ minHeight: 64, borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px clamp(18px,4vw,36px)' }}>
      <div><div style={{ fontWeight: 850 }}>{data.context.agencyName}</div><div style={{ fontSize: 11, color: '#64748b' }}>{data.context.role} · {data.context.email}</div></div>
      <button onClick={async () => { await fetch('/api/platform/self/logout',{method:'POST'}); window.location.href='/agency/login' }} style={iconButton} title="Sign out"><LogOut size={15} /></button>
    </header>
    <div style={{ padding: 'clamp(18px,4vw,36px)', maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 22 }}>
        <Metric icon={<Building2 size={15}/>} label="Clients" value={data.workspaces.length}/><Metric icon={<Clock3 size={15}/>} label="Approvals" value={data.pendingApprovals}/><Metric icon={<CheckCircle2 size={15}/>} label="Appointments" value={data.reports.reduce((sum,row)=>sum+Number(row.appointments),0)}/><Metric icon={<DollarSign size={15}/>} label="Revenue 30d" value={`$${data.reports.reduce((sum,row)=>sum+Number(row.revenue),0).toLocaleString()}`}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 18, alignItems: 'start' }}>
        <section style={panel}><div style={panelHeader}>Add Client From Website</div><form onSubmit={onboard} style={{ padding: 16 }}><input value={url} onChange={(event)=>setUrl(event.target.value)} required placeholder="https://clientwebsite.com" style={input}/><input value={niche} onChange={(event)=>setNiche(event.target.value)} placeholder="Niche (optional)" style={input}/><button disabled={busy} style={button}><Plus size={14}/>{busy?'Working...':'Analyze business'}</button>{message&&<p style={messageStyle}>{message}</p>}</form>{sessions.filter(s=>s.status==='review').map(session=><div key={session.id} style={row}><div><strong>{session.business_dna?.businessName}</strong><div style={muted}>{session.business_dna?.niche} · {session.business_dna?.services?.length ?? 0} services · {session.integration_blockers?.length ?? 0} integrations needed</div></div><button disabled={busy} onClick={()=>confirm(session.id)} style={smallButton}>Provision</button></div>)}</section>
        <section style={panel}><div style={panelHeader}>Client Workspaces</div>{data.workspaces.length===0?<div style={empty}>No clients yet.</div>:data.workspaces.map(workspace=><div key={workspace.id} style={{borderBottom:'1px solid #1a1a2e'}}><div style={{...row,borderBottom:'none'}}><div><strong>{workspace.business_name}</strong><div style={muted}>{workspace.industry ?? 'Local business'} · {workspace.lifecycle_stage} · {workspace.installed_agents} agents</div></div><a href={workspace.website_url} target="_blank" rel="noreferrer" style={{ color:'#818cf8',fontSize:12 }}>Website</a></div>{(data.integrations??[]).filter(item=>item.workspace_id===workspace.id).map(item=><div key={item.provider} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'7px 16px',fontSize:11,color:'#64748b'}}><span>{item.provider} · {item.status}</span>{['google_ads','meta_ads','instagram_ads','facebook_page','instagram','threads'].includes(item.provider)&&<a href={`/api/platform/self/integrations/${item.provider}/start?workspaceId=${workspace.id}`} style={{color:'#818cf8'}}>Connect</a>}</div>)}</div>)}</section>
        {approvals.length>0&&<section style={panel}><div style={panelHeader}>Approval Queue</div>{approvals.map(item=><div key={item.id} style={row}><div><strong>{item.agent_name??item.agent_id}</strong><div style={muted}>{item.business_name}</div></div><div style={{display:'flex',gap:6}}><button disabled={busy} onClick={()=>decide(item.id,'approve')} style={smallButton}>Approve</button><button disabled={busy} onClick={()=>decide(item.id,'reject')} style={{...smallButton,background:'#121220'}}>Reject</button></div></div>)}</section>}
        {(data.context.role==='owner'||data.context.role==='operator'||data.context.role==='specialist')&&<section style={panel}><div style={panelHeader}>Partner Catalog</div><form onSubmit={submitCatalog} style={{padding:16}}><input value={catalogName} onChange={event=>setCatalogName(event.target.value)} required placeholder="Agent name" style={input}/><textarea value={catalogDescription} onChange={event=>setCatalogDescription(event.target.value)} required placeholder="What it does, permissions, and expected output" style={{...input,minHeight:76,padding:10}}/><button disabled={busy} style={button}>Submit agent</button></form><div style={{padding:'0 16px 14px',fontSize:11,color:'#64748b'}}>{catalog.agents?.length??0} approved agents available · {catalog.submissions?.length??0} submissions</div></section>}
      </div>
    </div>
  </main>
}

function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:string|number}) { return <div style={{...panel,padding:15}}><div style={{display:'flex',gap:7,color:'#818cf8',alignItems:'center',fontSize:11,fontWeight:800,textTransform:'uppercase'}}>{icon}{label}</div><div style={{fontSize:25,fontWeight:850,marginTop:9}}>{value}</div></div> }
const panel:React.CSSProperties={background:'#0d0d1b',border:'1px solid #1a1a2e',borderRadius:8,overflow:'hidden'}
const panelHeader:React.CSSProperties={padding:'12px 16px',borderBottom:'1px solid #1a1a2e',fontSize:11,fontWeight:800,color:'#64748b',textTransform:'uppercase'}
const input:React.CSSProperties={width:'100%',minHeight:40,border:'1px solid #252540',borderRadius:6,background:'#121220',color:'#e2e8f0',padding:'0 11px',marginBottom:10}
const button:React.CSSProperties={display:'inline-flex',alignItems:'center',gap:7,minHeight:38,border:0,borderRadius:6,background:'#6366f1',color:'#fff',padding:'0 14px',fontWeight:800,cursor:'pointer'}
const smallButton:React.CSSProperties={...button,minHeight:32,fontSize:11}
const iconButton:React.CSSProperties={display:'grid',placeItems:'center',width:34,height:34,border:'1px solid #252540',borderRadius:6,background:'#121220',color:'#94a3b8',cursor:'pointer'}
const row:React.CSSProperties={display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'14px 16px',borderBottom:'1px solid #1a1a2e',fontSize:13}
const muted:React.CSSProperties={fontSize:11,color:'#64748b',marginTop:4}
const empty:React.CSSProperties={padding:22,color:'#64748b',fontSize:12}
const messageStyle:React.CSSProperties={fontSize:12,color:'#94a3b8',marginTop:10,lineHeight:1.5}
