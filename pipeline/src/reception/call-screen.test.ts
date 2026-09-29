import test from 'node:test'
import assert from 'node:assert/strict'
import { callerText, classifyTrust, declineTwiml, gateTwiml, looksLikeRobocall, outageTwiml, stirLevel } from './call-screen.js'

test('stirLevel parses Twilio StirVerstat values', () => {
  assert.equal(stirLevel('TN-Validation-Passed-A'), 'A')
  assert.equal(stirLevel('TN-Validation-Passed-C'), 'C')
  assert.equal(stirLevel('TN-Validation-Failed-A'), 'failed')
  assert.equal(stirLevel('No-TN-Validation'), 'none')
  assert.equal(stirLevel(''), 'none')
  assert.equal(stirLevel(undefined), 'none')
})

test('looksLikeRobocall catches IVR phrases, including word-fragmented transcripts', () => {
  assert.equal(looksLikeRobocall('Please press one to verify your account'), true)
  assert.equal(looksLikeRobocall('Ple ase press one to ve ri fy'), true)
  assert.equal(looksLikeRobocall('this is an automated message'), true)
  assert.equal(looksLikeRobocall('Hi, do you handle emergency AC repair?'), false)
  assert.equal(looksLikeRobocall("I'd press on with the install next week"), false)
  assert.equal(looksLikeRobocall(''), false)
  // Real transcripts from the 2026-08 Google-listing scam robocalls
  assert.equal(looksLikeRobocall('Cli ents are cur rently having tro uble fi nding you . Pre ss one to speak with an agen t i mmedia tely and ve rify your Go ogle lis ting'), true)
  assert.equal(looksLikeRobocall('Pre ss one to speak to an agen t . Pre ss two or di al 8 7 7 5 5 6 9 2 5 5'), true)
  assert.equal(looksLikeRobocall('Cli ends are cur rently havi ng tro uble fi nding you'), true)
  // Real people must never match
  assert.equal(looksLikeRobocall('I need to express one thing, my furnace is out'), false)
  assert.equal(looksLikeRobocall('can I speak to an agent about my Google listing'), false)
  assert.equal(looksLikeRobocall('I have trouble finding parts for my unit'), false)
})

test('callerText keeps only caller lines from a merged or fragmented transcript', () => {
  const t = 'AI: Thanks for calling\nCaller: my AC is broken\nAI: I can help\nCaller: it is 95 degrees'
  assert.match(callerText(t), /my AC is broken/)
  assert.match(callerText(t), /95 degrees/)
  assert.doesNotMatch(callerText(t), /Thanks for calling/)
  assert.equal(callerText('AI: hello there'), '')
})

const base = { transcript: 'AI: Thanks for calling\nCaller: my AC stopped working and it is really hot in here', ownerPhones: ['+14156060079'] }

test('classifyTrust: owner, self, widget win before any transcript reading', () => {
  assert.equal(classifyTrust({ ...base, caller: '+1 (415) 606-0079' }), 'owner')
  assert.equal(classifyTrust({ ...base, caller: '+19182555151', selfNumbers: ['+19182555151'] }), 'self')
  assert.equal(classifyTrust({ ...base, caller: null, channel: 'widget' }), 'widget')
})

test('classifyTrust: real conversation is human, IVR is suspected_bot, silence is no_speech', () => {
  assert.equal(classifyTrust({ ...base, caller: '+18565268063' }), 'human')
  assert.equal(classifyTrust({ caller: '+19189999013', transcript: 'AI: hi\nCaller: Please press one to verify your account' }), 'suspected_bot')
  assert.equal(classifyTrust({ caller: '+19180000000', transcript: 'AI: Thanks for calling. What would you like?' }), 'no_speech')
})

test('classifyTrust: a failed STIR check plus a tiny utterance is a bot; a long real utterance still passes', () => {
  assert.equal(classifyTrust({ caller: '+19181112222', transcript: 'AI: hi\nCaller: hello', stir: 'TN-Validation-Failed-A' }), 'suspected_bot')
  assert.equal(classifyTrust({ ...base, caller: '+19181112222', stir: 'TN-Validation-Failed-A' }), 'human')
})

test('classifyTrust: passing the press-1 gate makes a short real reply human', () => {
  const t = 'AI: hi\nCaller: yes I need a quote'
  assert.equal(classifyTrust({ caller: '+19183334444', transcript: t }), 'unknown')
  assert.equal(classifyTrust({ caller: '+19183334444', transcript: t, gatePassed: true }), 'human')
})

test('gateTwiml asks for one digit and posts back; declineTwiml hangs up', () => {
  const x = gateTwiml('WebCrew', 'https://x.example/voice/abc?gate=1&y=2')
  assert.match(x, /<Gather input="dtmf" numDigits="1"/)
  assert.match(x, /action="https:\/\/x\.example\/voice\/abc\?gate=1&amp;y=2"/)
  assert.match(x, /<Hangup\/>/)
  assert.match(declineTwiml('Try later <b>'), /<Hangup\/>/)
  assert.doesNotMatch(declineTwiml('Try later <b>'), /<b>/)
})

test('outageTwiml: rings the owner cell when known, never the line itself, else a plain apology', () => {
  assert.match(outageTwiml('(415) 606-0079', '+19342482253'), /<Dial timeout="25">\+14156060079<\/Dial>/)
  assert.doesNotMatch(outageTwiml('+19342482253', '+19342482253'), /<Dial/)      // owner number == the AI line: would loop
  assert.doesNotMatch(outageTwiml(null, '+19342482253'), /<Dial/)
  assert.doesNotMatch(outageTwiml('12345', null), /<Dial/)                         // not a full number
  assert.match(outageTwiml(undefined, undefined), /<Hangup\/>/)
})
