import 'dotenv/config'
import { getSheetId } from '../tools/google-sheets.js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createSign } from 'crypto'

async function getToken(): Promise<string> {
  let sa: any
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    sa = JSON.parse(readFileSync(resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE), 'utf8'))
  } else throw new Error('No service account configured')
  const now = Math.floor(Date.now()/1000)
  const h = Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url')
  const p = Buffer.from(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',exp:now+3600,iat:now})).toString('base64url')
  const s = createSign('RSA-SHA256'); s.update(h+'.'+p)
  const jwt = h+'.'+p+'.'+s.sign(sa.private_key,'base64url')
  const tk = await (await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion='+jwt})).json() as any
  if (!tk.access_token) throw new Error('Token failed: '+JSON.stringify(tk))
  return tk.access_token
}

async function main() {
  const token = await getToken()
  const d = await (await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+process.env.LEADS_SHEET_ID+'?fields=sheets.properties',{headers:{Authorization:'Bearer '+token}})).json() as any
  console.log('Tabs in spreadsheet:')
  d.sheets?.forEach((s:any,i:number)=>console.log(`  ${i+1}. "${s.properties.title}"  (sheetId: ${s.properties.sheetId})`))
}
main().catch(e=>{console.error(e.message);process.exit(1)})
