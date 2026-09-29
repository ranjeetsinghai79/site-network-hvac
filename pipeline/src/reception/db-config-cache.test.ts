import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { getReceptionConfigById, peekCachedConfig, pool } from './db.js'

const row = { id: 'cfg-1', lead_id: null, website_url: 'https://acme.example', business_name: 'Acme HVAC', brain_json: { owner_phone: '(415) 606-0079' }, system_prompt: 'p', twilio_phone: '+15550000001', active: true, created_at: new Date().toISOString() }

test('config lookup: a database error serves the last-known-good config instead of failing the call', async () => {
  const q = mock.method(pool, 'query', async () => ({ rows: [row] }) as any)
  const live = await getReceptionConfigById('cfg-1')
  assert.equal(live?.business_name, 'Acme HVAC')
  assert.equal(peekCachedConfig('cfg-1')?.brain?.owner_phone, '(415) 606-0079')

  q.mock.mockImplementation(async () => { throw new Error('exceeded the quota') })
  const stale = await getReceptionConfigById('cfg-1')
  assert.equal(stale?.business_name, 'Acme HVAC', 'serves the cached copy during an outage')
  await assert.rejects(() => getReceptionConfigById('never-seen'), /exceeded the quota/, 'no cache for an unknown line → the error surfaces so /voice can send its fallback')
  q.mock.restore()
})

test('config lookup: while the database is healthy a change is seen immediately (the cache is fallback-only)', async () => {
  const q = mock.method(pool, 'query', async () => ({ rows: [{ ...row, id: 'cfg-2', business_name: 'Before' }] }) as any)
  assert.equal((await getReceptionConfigById('cfg-2'))?.business_name, 'Before')
  q.mock.mockImplementation(async () => ({ rows: [{ ...row, id: 'cfg-2', business_name: 'After' }] }) as any)
  assert.equal((await getReceptionConfigById('cfg-2'))?.business_name, 'After')
  q.mock.restore()
})
