import test from 'node:test'
import assert from 'node:assert/strict'

import { formatAssistantPlainText } from '../src/lib/chatbot/plain-text.js'

test('removes common Markdown formatting from assistant replies', () => {
  const formatted = formatAssistantPlainText(
    '**Current Progress:**\n* **Status:** Partially Received\n`ORD-2026-911`'
  )

  assert.equal(
    formatted,
    'Current Progress:\n- Status: Partially Received\nORD-2026-911'
  )
})
