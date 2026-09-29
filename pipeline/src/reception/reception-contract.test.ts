import assert from 'node:assert/strict'
import test from 'node:test'
import { getReceptionPricingToolResponse, RECEPTION_CONVERSATION_STATES, RECEPTION_OFFER } from './reception-contract.js'
import { WEBCREW_SYSTEM_PROMPT } from './webcrew-prompt.js'

test('published offer and runtime pricing response use the same values', () => {
  const response = getReceptionPricingToolResponse()
  assert.equal(response.plan.price, `$${RECEPTION_OFFER.monthlyPriceCents / 100}/month`)
  assert.equal(response.freeTrial.days, RECEPTION_OFFER.trialDays)
  assert.equal(response.setupFee.today, 0)
  assert.match(response.commercialPolicy, /Do not negotiate/)
})

test('system prompt contains every mandatory conversation state', () => {
  for (const state of RECEPTION_CONVERSATION_STATES) {
    assert.match(WEBCREW_SYSTEM_PROMPT, new RegExp(state))
  }
})

test('system prompt has no expired or contradictory trial language', () => {
  assert.doesNotMatch(WEBCREW_SYSTEM_PROMPT, /2 weeks|two weeks|September 25/i)
  assert.match(WEBCREW_SYSTEM_PROMPT, /30-day free trial/i)
  assert.match(WEBCREW_SYSTEM_PROMPT, /do not negotiate/i)
})

test('accepted trial has a deterministic Stripe checkout path', () => {
  assert.match(WEBCREW_SYSTEM_PROMPT, /requested_next_action=start_trial/)
  assert.match(WEBCREW_SYSTEM_PROMPT, /call start_trial immediately/i)
  assert.match(WEBCREW_SYSTEM_PROMPT, /trial starts only after they complete Stripe checkout/i)
  assert.match(WEBCREW_SYSTEM_PROMPT, /take_message alone does not start a trial/i)
  assert.match(WEBCREW_SYSTEM_PROMPT, /Do not require or introduce a consultation/i)
  assert.match(WEBCREW_SYSTEM_PROMPT, /before the corresponding tool returns success/i)
})
