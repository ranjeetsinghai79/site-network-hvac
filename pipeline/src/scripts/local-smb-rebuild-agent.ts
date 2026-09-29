/** Local SMB Talking Website campaign. Every costly/external action is HITL-gated. */
import 'dotenv/config'
import pg from 'pg'
import { chromium, type Page } from 'playwright'
import { readSheetRows, writeRangeValues, batchUpdateSheet, getSheetId } from '../tools/google-sheets.js'
import { scoreSite } from '../tools/pagespeed.js'
import { buildLeadFromPlacesMatch } from '../tools/place-match-builder.js'
import { getLeadById } from '../db/supabase.js'
import { deleteCloudflarePagesProject } from '../tools/cloudflare.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const SHEET_ID = process.env.LEADS_SHEET_ID ?? '1wwZX7eriuA0i37t6_VOetkmHcS7YKiHXI2DYj7gfa9A'
const SHEET_NAME = process.env.LOCAL_SMB_SHEET ?? 'Local SMBs'
const DAILY_LIMIT = Math.min(50, Math.max(1, Number(process.env.LOCAL_SMB_DAILY_LIMIT ?? 50)))
const EMAIL_LIMIT = Math.min(100, Math.max(1, Number(process.env.OUTREACH_DAILY_EMAIL_LIMIT ?? 100)))
const DRY_RUN = process.env.DRY_RUN === 'true'
const DAY = 86_400_000
type Audit = { qualifies:boolean; reasons:string[]; evidenceYear?:number; mobileScore:number; issues:string[]; hasInteractiveForm:boolean; hasBooking:boolean; hasChat:boolean; hasAiSalesperson:boolean }
type Job = { id:string; business_name:string; niche:string; city:string; state:string; phone:string|null; email:string|null; source_url:string; status:string; audit_json:Audit; lead_id:string|null; preview_url:string|null; cloudflare_project:string|null; reception_config_id:string|null; email_send_count:number }
const q = (sql:string, values:unknown[] = []) => pool.query(sql, values)
const normalizeUrl = (raw:string) => new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).toString()
const normalizeNiche = (raw:string) => raw.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'generic-business'
const projectFromUrl = (url:string) => { try { const h=new URL(url).hostname; return h.endsWith('.pages.dev') ? h.slice(0,-10) : null } catch { return null } }
const esc = (s:string) => s.replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!))

const SHEET_HEADERS = ['WebCrew Status','WebCrew Audit Notes','WebCrew Job ID','Preview URL','Approval / Next Action','Preview Expires']
function nextAction(status:string){return ({audit_ready:'Review notes; approve or reject build',approved_to_build:'Approved — waiting to build',building:'Building preview',preview_ready:'Review preview; approve or reject outreach',approved_to_contact:'Approved — waiting to contact',contacted:'Email/form outreach active',rejected:'Rejected — no action',claimed:'Client interested — retain preview',expired:'Seven-day preview removed',failed:'Needs manual review'} as Record<string,string>)[status]??status}
async function syncSheetJobs(ids?:string[]){
  await writeRangeValues({spreadsheetId:SHEET_ID,range:`${SHEET_NAME}!W1:AB1`,values:[SHEET_HEADERS]})
  const {rows}=await q(`SELECT id,sheet_row,status,audit_json,preview_url,expires_at FROM local_smb_rebuild_jobs WHERE spreadsheet_id=$1 AND sheet_name=$2${ids?.length?' AND id=ANY($3)':''} ORDER BY sheet_row`,ids?.length?[SHEET_ID,SHEET_NAME,ids]:[SHEET_ID,SHEET_NAME])
  for(const row of rows){const notes=[...(row.audit_json?.reasons??[]),...(row.audit_json?.issues??[])].join('; ');await writeRangeValues({spreadsheetId:SHEET_ID,range:`${SHEET_NAME}!W${row.sheet_row}:AB${row.sheet_row}`,values:[[row.status,notes,row.id,row.preview_url??'',nextAction(row.status),row.expires_at?new Date(row.expires_at).toISOString():'']]})}
  const sheetId=await getSheetId({spreadsheetId:SHEET_ID,sheetName:SHEET_NAME})
  if(sheetId!=null)await batchUpdateSheet({spreadsheetId:SHEET_ID,requests:[
    {repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:22,endColumnIndex:28},cell:{userEnteredFormat:{backgroundColorStyle:{rgbColor:{red:0.12,green:0.16,blue:0.24}},textFormat:{bold:true,foregroundColorStyle:{rgbColor:{red:1,green:1,blue:1}}},wrapStrategy:'WRAP'}},fields:'userEnteredFormat(backgroundColorStyle,textFormat,wrapStrategy)'}},
    {repeatCell:{range:{sheetId,startRowIndex:1,startColumnIndex:23,endColumnIndex:24},cell:{userEnteredFormat:{wrapStrategy:'WRAP'}},fields:'userEnteredFormat.wrapStrategy'}},
    {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:22,endIndex:28},properties:{pixelSize:180},fields:'pixelSize'}},
  ]})
}

async function fetchHtml(url:string) {
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15_000)
  try { const r=await fetch(url,{signal:controller.signal,redirect:'follow',headers:{'User-Agent':'WebCrewSiteAudit/1.0'}}); return {html:(await r.text()).slice(0,1_000_000),lastModified:r.headers.get('last-modified')??undefined} }
  finally { clearTimeout(timer) }
}
function evidenceYear(html:string,lastModified?:string) {
  const years:number[]=[]; const now=new Date().getFullYear()
  for(const m of html.matchAll(/(?:copyright|&copy;|©)[^\n<]{0,80}?((?:19|20)\d{2})/gi)) years.push(Number(m[1]))
  if(lastModified){const y=new Date(lastModified).getUTCFullYear();if(y>=1990&&y<=now)years.push(y)}
  return years.length?Math.max(...years.filter(y=>y<=now)):undefined
}
async function auditWebsite(url:string):Promise<Audit>{
  const [site,score]=await Promise.all([fetchHtml(url).catch(()=>({html:'',lastModified:undefined as string|undefined})),scoreSite(url).catch(()=>({mobile_score:0,issues:['Site could not be scored'],broken:true} as any))])
  const html=site.html, year=evidenceYear(html,site.lastModified), cutoff=new Date().getFullYear()-5
  const hasInteractiveForm=/<form\b/i.test(html), hasBooking=/(book(?:ing)?|schedule|appointment|calendly|acuity|mindbody)/i.test(html)
  const hasChat=/(intercom|drift|tawk\.to|livechat|crisp\.chat|chat-widget|chatbot)/i.test(html)
  const hasAiSalesperson=/(ai (?:sales|reception|assistant)|talk(?:ing)? website|voice assistant|gemini-live|widget-ws)/i.test(html)
  const reasons:string[]=[]
  if(year&&year<=cutoff)reasons.push(`visible site evidence is from ${year} (at least five years old)`)
  if(!hasInteractiveForm&&!hasBooking&&!hasChat)reasons.push('no interactive enquiry, booking, or chat experience detected')
  if(!hasAiSalesperson)reasons.push('no AI salesperson or voice assistant detected')
  if(score.broken)reasons.push('current website appears unavailable')
  if(score.scored && !score.broken && score.mobile_score<50)reasons.push(`mobile performance is ${score.mobile_score}/100`)
  return {qualifies:reasons.length>0,reasons,evidenceYear:year,mobileScore:score.mobile_score,issues:score.issues,hasInteractiveForm,hasBooking,hasChat,hasAiSalesperson}
}
async function scan(){
  const rows=await readSheetRows({spreadsheetId:SHEET_ID,sheetName:SHEET_NAME,range:'A2:V'})
  const old=await q(`SELECT sheet_row,source_url FROM local_smb_rebuild_jobs WHERE spreadsheet_id=$1 AND sheet_name=$2`,[SHEET_ID,SHEET_NAME])
  const seenRows=new Set(old.rows.map(r=>Number(r.sheet_row))), seenUrls=new Set(old.rows.map(r=>r.source_url)); let audited=0,queued=0
  for(let i=0;i<rows.length&&audited<DAILY_LIMIT;i++){
    const r=rows[i],sheetRow=i+2;if((r[8]??'').trim().toUpperCase()!=='YES'||!r[9]||seenRows.has(sheetRow))continue
    let url:string;try{url=normalizeUrl(r[9].trim())}catch{continue}if(seenUrls.has(url))continue
    console.log(`[${++audited}/${DAILY_LIMIT}] ${r[1]} — ${url}`);const audit=await auditWebsite(url);if(!audit.qualifies)continue
    const inserted=await q(`INSERT INTO local_smb_rebuild_jobs (spreadsheet_id,sheet_name,sheet_row,business_name,niche,city,state,phone,email,source_url,audit_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING RETURNING id`,[SHEET_ID,SHEET_NAME,sheetRow,r[1]||'Unknown business',r[2]||'generic-business',r[3]||'',r[4]||'',r[6]||null,r[7]||null,url,JSON.stringify(audit)]);if(inserted.rowCount)queued++
  }
  if(queued)await syncSheetJobs()
  console.log(`Audited ${audited}; queued ${queued} for human approval.`)
}
async function list(status?:string){const {rows}=await q(`SELECT id,business_name,status,source_url,preview_url,audit_json,email_send_count,expires_at,last_error FROM local_smb_rebuild_jobs ${status?'WHERE status=$1':''} ORDER BY created_at LIMIT 200`,status?[status]:[]);console.table(rows.map(r=>({id:r.id,business:r.business_name,status:r.status,score:r.audit_json?.mobileScore,year:r.audit_json?.evidenceYear,preview:r.preview_url,emails:r.email_send_count,error:r.last_error})))}
async function approve(kind:'build'|'contact',id:string){const from=kind==='build'?'audit_ready':'preview_ready',to=kind==='build'?'approved_to_build':'approved_to_contact',at=kind==='build'?'approved_to_build_at':'approved_to_contact_at';const values=id==='all'?[from]:[from,id];const result=await q(`UPDATE local_smb_rebuild_jobs SET status='${to}',${at}=now(),updated_at=now() WHERE status=$1${id==='all'?'':' AND id=$2'}`,values);await syncSheetJobs(id==='all'?undefined:[id]);console.log(`Approved ${result.rowCount} job(s) for ${kind}.`)}
async function build(){
  const {rows}=await q(`SELECT * FROM local_smb_rebuild_jobs WHERE status='approved_to_build' ORDER BY approved_to_build_at LIMIT $1`,[DAILY_LIMIT])
  for(const job of rows as Job[]){if(DRY_RUN){console.log(`[dry-run] Would build ${job.business_name}`);continue}await q(`UPDATE local_smb_rebuild_jobs SET status='building',updated_at=now() WHERE id=$1 AND status='approved_to_build'`,[job.id])
    try{const result=await buildLeadFromPlacesMatch({phone:job.phone??undefined,name:job.business_name,niche:normalizeNiche(job.niche),city:job.city,state:job.state,tier:'tier2',talkingWebsite:true});if(!result)throw new Error('Places match/build/deployment returned no result');const lead=await getLeadById(result.leadId);await q(`UPDATE local_smb_rebuild_jobs SET status='preview_ready',lead_id=$2,preview_url=$3,cloudflare_project=$4,reception_config_id=$5,expires_at=now()+interval '7 days',updated_at=now() WHERE id=$1`,[job.id,result.leadId,result.deployedUrl,projectFromUrl(result.deployedUrl),(lead as any)?.reception_config_id??null]);console.log(`Preview ready: ${result.deployedUrl}`)}catch(e:any){await q(`UPDATE local_smb_rebuild_jobs SET status='failed',last_error=$2,updated_at=now() WHERE id=$1`,[job.id,String(e.message).slice(0,1000)])}
  }
  await syncSheetJobs(rows.map((r:Job)=>r.id))
}
function copy(job:Job,n:number){if(n===0)return{subject:`We rebuilt ${job.business_name}'s website — live preview`,text:`Hi — we reviewed ${job.business_name}'s website and built a private seven-day preview using your existing public brand, services, and media where suitable. It includes a talking AI salesperson that can answer questions, qualify enquiries, and help book appointments 24/7.\n\nPreview: ${job.preview_url}\n\nIf you'd like changes, reply to this message. — WebCrew\n\nTo opt out, reply “no thanks”.`};const lines=[`Just making sure you saw the seven-day website and AI salesperson preview for ${job.business_name}: ${job.preview_url}`,`Your preview is still live. The talking AI can answer FAQs, qualify visitors, and help them book: ${job.preview_url}`,`Last note before we remove ${job.business_name}'s preview: ${job.preview_url}`];return{subject:`${job.business_name} preview — follow-up ${n}`,text:`${lines[n-1]}\n\nReply if you want us to keep it or revise it. — WebCrew\n\nTo opt out, reply “no thanks”.`}}
async function sendEmail(job:Job){if(!job.email||!job.preview_url)return false;const c=copy(job,job.email_send_count),html=`<div style="font-family:Arial,sans-serif;max-width:640px;line-height:1.65;color:#171717">${c.text.split('\n').map(p=>`<p>${esc(p)}</p>`).join('')}</div>`;const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`local-smb-${job.id}-${job.email_send_count+1}`},body:JSON.stringify({from:process.env.OUTREACH_FROM_EMAIL??'hello@webcrew.app',to:job.email,subject:c.subject,html})});if(!r.ok)throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0,300)}`);return true}
async function contactPage(page:Page,url:string){await page.goto(url,{waitUntil:'domcontentloaded',timeout:30_000});const href=await page.locator('a').evaluateAll((els:any[])=>els.map(a=>({h:a.href,t:(a.textContent||'').trim()})).find(x=>/contact|quote|estimate|inquir/i.test(`${x.t} ${x.h}`))?.h).catch(()=>undefined);if(href)await page.goto(href,{waitUntil:'domcontentloaded',timeout:30_000}).catch(()=>{})}
async function submitForm(job:Job){if(!job.preview_url)return false;const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();await contactPage(page,job.source_url);const form=page.locator('form').filter({has:page.locator('textarea, input[type="email"]')}).first();if(!await form.count())return false;const fill=async(s:string,v:string)=>{const el=form.locator(s).first();if(v&&await el.count()&&await el.isVisible().catch(()=>false))await el.fill(v).catch(()=>{})};await fill('input[name*="name" i],input[placeholder*="name" i]','WebCrew');await fill('input[type="email"],input[name*="email" i]',process.env.OUTREACH_FROM_EMAIL??'hello@webcrew.app');await fill('input[type="tel"],input[name*="phone" i]',process.env.OUTREACH_PHONE??'');await fill('input[name*="subject" i]',`Website preview for ${job.business_name}`);await fill('textarea',copy(job,0).text);const empty=await form.locator('input[required],textarea[required],select[required]').evaluateAll((els:any[])=>els.some(e=>!e.value&&e.type!=='checkbox'));if(empty)return false;const button=form.locator('button[type="submit"],input[type="submit"],button').first();if(!await button.count())return false;await button.click();await page.waitForTimeout(2000);return true}finally{await browser.close()}}
async function sentToday(){const {rows}=await q(`SELECT count(*)::int n FROM local_smb_rebuild_email_events WHERE sent_at>=date_trunc('day',now())`);return Number(rows[0]?.n??0)}
async function send(){let remaining=EMAIL_LIMIT-await sentToday();if(remaining<=0){console.log(`Daily email cap (${EMAIL_LIMIT}) reached.`);return}const {rows}=await q(`SELECT * FROM local_smb_rebuild_jobs WHERE status='approved_to_contact' OR (status='contacted' AND next_followup_at<=now() AND email_send_count<4 AND expires_at>now()) ORDER BY COALESCE(next_followup_at,approved_to_contact_at) LIMIT $1`,[remaining]);for(const job of rows as Job[]){if(DRY_RUN){console.log(`[dry-run] Would contact ${job.business_name}`);continue}try{const initial=job.status==='approved_to_contact',emailed=await sendEmail(job);if(emailed){remaining--;await q(`INSERT INTO local_smb_rebuild_email_events(job_id,sequence_number) VALUES($1,$2) ON CONFLICT DO NOTHING`,[job.id,job.email_send_count+1])}const formed=initial?await submitForm(job).catch(()=>false):false,newCount=job.email_send_count+(emailed?1:0),next=job.email&&newCount<4?new Date(Date.now()+2*DAY):null;await q(`UPDATE local_smb_rebuild_jobs SET status='contacted',contacted_at=COALESCE(contacted_at,now()),form_submitted_at=CASE WHEN $2 THEN COALESCE(form_submitted_at,now()) ELSE form_submitted_at END,email_send_count=$3,next_followup_at=$4,updated_at=now() WHERE id=$1`,[job.id,formed,newCount,next]);console.log(`${job.business_name}: email=${emailed} form=${formed} send=${newCount}/4`)}catch(e:any){await q(`UPDATE local_smb_rebuild_jobs SET last_error=$2,updated_at=now() WHERE id=$1`,[job.id,String(e.message).slice(0,1000)])}if(remaining<=0)break}}
async function cleanup(){const {rows}=await q(`SELECT * FROM local_smb_rebuild_jobs WHERE expires_at<=now() AND status IN ('preview_ready','approved_to_contact','contacted')`);for(const job of rows as Job[]){if(!job.cloudflare_project){await q(`UPDATE local_smb_rebuild_jobs SET status='expired',updated_at=now() WHERE id=$1`,[job.id]);continue}if(DRY_RUN){console.log(`[dry-run] Would delete ${job.cloudflare_project}`);continue}const ok=await deleteCloudflarePagesProject(job.cloudflare_project);if(ok&&job.reception_config_id)await q(`UPDATE reception_configs SET active=false WHERE id=$1`,[job.reception_config_id]);await q(`UPDATE local_smb_rebuild_jobs SET status=$2,last_error=$3,updated_at=now() WHERE id=$1`,[job.id,ok?'expired':job.status,ok?null:'Cloudflare preview deletion failed'])}}
async function main(){const [cmd,arg]=process.argv.slice(2);if(cmd==='scan')await scan();else if(cmd==='daily'){await cleanup();await scan();await send();await syncSheetJobs()}else if(cmd==='list')await list(arg);else if(cmd==='sync-sheet')await syncSheetJobs(arg?[arg]:undefined);else if(cmd==='approve-build'&&arg)await approve('build',arg);else if(cmd==='build')await build();else if(cmd==='approve-contact'&&arg)await approve('contact',arg);else if(cmd==='send'){await send();await syncSheetJobs()}else if(cmd==='cleanup'){await cleanup();await syncSheetJobs()}else if((cmd==='reject'||cmd==='claim')&&arg){await q(`UPDATE local_smb_rebuild_jobs SET status=$2,updated_at=now() WHERE id=$1`,[arg,cmd==='reject'?'rejected':'claimed']);await syncSheetJobs([arg]);console.log(`${arg} → ${cmd}`)}else console.log('Usage: daily|scan|list [status]|sync-sheet [id]|approve-build <id|all>|build|approve-contact <id|all>|send|reject <id>|claim <id>|cleanup')}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end())
