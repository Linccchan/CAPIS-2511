import test from 'node:test'
import assert from 'node:assert/strict'

import { createChatRateLimiter } from '../src/lib/chatbot/rate-limit.js'

test('allows consecutive messages by default', () => {
  const limiter = createChatRateLimiter()

  assert.equal(limiter.check('customer-1', 1_000).allowed, true)
  assert.equal(limiter.check('customer-1', 1_001).allowed, true)
})

test('enforces the maximum number of requests in a window', () => {
  const limiter = createChatRateLimiter({
    maxRequests: 2,
    minIntervalMs: 0,
    windowMs: 10_000,
  })

  assert.equal(limiter.check('customer-1', 1_000).allowed, true)
  assert.equal(limiter.check('customer-1', 2_000).allowed, true)
  assert.equal(limiter.check('customer-1', 3_000).allowed, false)
  assert.equal(limiter.check('customer-1', 12_000).allowed, true)
})
