import assert from 'node:assert/strict'
import test from 'node:test'
import { buildVoiceFallbackUrl, redirectCallToVoiceFallback, withTimeout } from './call-fallback.js'

test('builds encoded inbound and outbound fallback URLs', () => {
  assert.equal(buildVoiceFallbackUrl('config/id', 'inbound'), 'https://ai-reception-459352382653.us-central1.run.app/voice/config%2Fid?recovery=1')
  assert.equal(buildVoiceFallbackUrl('config/id', 'outbound', 2), 'https://ai-reception-459352382653.us-central1.run.app/voice/config%2Fid?recovery=2&outbound=1')
})

test('redirects an active Twilio call with POST TwiML URL update', async () => {
  process.env.TWILIO_ACCOUNT_SID = 'AC_test'
  process.env.TWILIO_AUTH_TOKEN = 'secret'
  let requestUrl = ''
  let requestInit: RequestInit | undefined
  const ok = await redirectCallToVoiceFallback({
    callSid: 'CA_test', configId: 'config-id', mode: 'inbound', reason: 'test',
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      requestUrl = String(url)
      requestInit = init
      return new Response('{}', { status: 200 })
    }) as typeof fetch,
  })

  assert.equal(ok, true)
  assert.match(requestUrl, /Calls\/CA_test\.json$/)
  assert.equal(requestInit?.method, 'POST')
  const body = new URLSearchParams(String(requestInit?.body))
  assert.equal(body.get('Url'), 'https://ai-reception-459352382653.us-central1.run.app/voice/config-id?recovery=1')
  assert.equal(body.get('Method'), 'POST')
})

test('reports a failed Twilio redirect', async () => {
  process.env.TWILIO_ACCOUNT_SID = 'AC_test'
  process.env.TWILIO_AUTH_TOKEN = 'secret'
  const ok = await redirectCallToVoiceFallback({
    callSid: 'CA_test', configId: 'config-id', mode: 'inbound', reason: 'test',
    fetchImpl: (async () => new Response('bad request', { status: 400 })) as typeof fetch,
  })
  assert.equal(ok, false)
})

test('withTimeout rejects hung setup work', async () => {
  await assert.rejects(
    withTimeout(new Promise<void>(() => {}), 5, 'setup'),
    /setup timed out after 5ms/,
  )
})
