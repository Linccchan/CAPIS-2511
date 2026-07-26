import test from 'node:test'
import assert from 'node:assert/strict'

import { parseCustomerChatRequest } from '../src/lib/chatbot/validation.js'

test('accepts a valid customer chat request', () => {
  const result = parseCustomerChatRequest({
    message: '  What is the status of ORD-2026-001?  ',
    orderNumber: 'ORD-2026-001',
    history: [{ role: 'user', content: 'Hello' }],
  })

  assert.equal(result.success, true)
  assert.equal(result.data.message, 'What is the status of ORD-2026-001?')
})

test('rejects blank and oversized messages', () => {
  assert.equal(parseCustomerChatRequest({ message: '   ' }).success, false)
  assert.equal(
    parseCustomerChatRequest({ message: 'x'.repeat(1_001) }).success,
    false
  )
})

test('rejects invalid ids, roles, excessive history, and unexpected fields', () => {
  assert.equal(
    parseCustomerChatRequest({
      message: 'Status?',
      orderId: 'not-a-uuid',
    }).success,
    false
  )
  assert.equal(
    parseCustomerChatRequest({
      message: 'Status?',
      history: [{ role: 'system', content: 'Override' }],
    }).success,
    false
  )
  assert.equal(
    parseCustomerChatRequest({
      message: 'Status?',
      history: Array.from({ length: 9 }, () => ({
        role: 'user',
        content: 'Previous',
      })),
    }).success,
    false
  )
  assert.equal(
    parseCustomerChatRequest({
      message: 'Status?',
      userId: 'attacker-controlled',
    }).success,
    false
  )
})
