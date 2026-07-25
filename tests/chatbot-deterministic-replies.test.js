import test from 'node:test'
import assert from 'node:assert/strict'

import { getDeterministicOrderReply } from '../src/lib/chatbot/deterministic-order-replies.js'

const orderContext = {
  orderNumber: 'ORD-2026-911',
  currentStatus: 'Partially Received',
  estimatedReadyDate: null,
  actualReadyDate: null,
  overallCompletionPercentage: 56,
  prediction: {
    estimatedShipmentReadinessDate: null,
  },
  payment: {
    downPaymentStatus: 'Verified',
    remainingBalanceStatus: 'Unavailable',
  },
  supplierDeliveries: {
    purchaseOrders: 2,
    purchaseOrdersCompleted: 0,
  },
  labeling: {
    completedQuantity: 0,
    requiredQuantity: 0,
  },
  documents: {
    customerVisibleCount: 0,
  },
  remainingSteps: [
    'Complete pending supplier deliveries',
    'Finalize shipment preparation',
  ],
  delayWarning:
    '2 supplier purchase orders currently show a past expected delivery date without completion.',
}

test('answers estimated readiness without calling an AI provider', () => {
  const reply = getDeterministicOrderReply({
    message: 'When is my order expected to be ready?',
    orderContext,
  })

  assert.match(reply, /not currently available/i)
  assert.match(reply, /ORD-2026-911/)
  assert.match(reply, /2 supplier purchase orders/i)
  assert.doesNotMatch(reply, /56 percent/i)
})

test('asks the customer to use the order selector when none is selected', () => {
  const reply = getDeterministicOrderReply({
    message: 'When is it expected?',
    orderContext: null,
    availableOrderNumbers: ['ORD-2026-911'],
  })

  assert.match(reply, /select an order from the dropdown/i)
})

test('uses the order estimated-ready date shown in the customer portal', () => {
  const reply = getDeterministicOrderReply({
    message: 'What is the estimated shipment date?',
    orderContext: {
      ...orderContext,
      estimatedReadyDate: '2026-07-10',
    },
  })

  assert.match(reply, /2026-07-10/)
  assert.doesNotMatch(reply, /not currently available/i)
})
