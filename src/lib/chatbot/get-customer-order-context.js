import 'server-only'

import {
  ChatbotDataError,
  ChatbotForbiddenError,
  ChatbotNotFoundError,
} from '@/lib/chatbot/errors'

const ACTIVE_ORDER_STATUSES = new Set([
  'draft',
  'submitted',
  'awaiting_down_payment',
  'payment_verified',
  'procurement_started',
  'partially_received',
  'warehouse_preparation',
  'ready_for_shipment',
  'shipped',
])

const ORDER_LIFECYCLE = [
  'submitted',
  'awaiting_down_payment',
  'payment_verified',
  'procurement_started',
  'partially_received',
  'warehouse_preparation',
  'ready_for_shipment',
  'shipped',
  'completed',
]

function friendlyStatus(value) {
  if (!value) return 'Unavailable'

  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function dateOnly(value) {
  if (!value) return null
  return String(value).slice(0, 10)
}

function numberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function countByStatus(rows) {
  return rows.reduce((counts, row) => {
    const status = friendlyStatus(row.status)
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, {})
}

function queryFailed(result, operation) {
  if (result.error) {
    throw new ChatbotDataError(operation)
  }

  return result.data || []
}

async function resolveCustomerIdentity(supabase, user) {
  const profileResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileResult.error) {
    throw new ChatbotDataError('profile lookup')
  }

  if (profileResult.data?.role !== 'customer') {
    throw new ChatbotForbiddenError()
  }

  const customerResult = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (customerResult.error) {
    throw new ChatbotDataError('customer lookup')
  }

  if (!customerResult.data) {
    throw new ChatbotForbiddenError()
  }

  return customerResult.data
}

async function loadCustomerOrders(supabase, user) {
  const customer = await resolveCustomerIdentity(supabase, user)
  const ordersResult = await supabase
    .from('customer_orders')
    .select(
      'id, order_number, status, order_date, confirmed_at, estimated_ready_date, actual_ready_date, created_at'
    )
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })

  return queryFailed(ordersResult, 'customer order lookup')
}

export async function getCustomerOrderOptions({ supabase, user }) {
  const orders = await loadCustomerOrders(supabase, user)

  return orders
    .filter((order) => order.order_number)
    .map((order) => ({
      orderNumber: order.order_number,
      status: friendlyStatus(order.status),
    }))
}

function findMentionedOrders(orders, text) {
  const normalizedText = text.toUpperCase()

  return orders.filter(
    (order) =>
      order.order_number &&
      normalizedText.includes(order.order_number.toUpperCase())
  )
}

function chooseOrder(orders, { orderId, orderNumber, message, history }) {
  if (orderId) {
    const selected = orders.find((order) => order.id === orderId)
    if (!selected) throw new ChatbotNotFoundError()
    return selected
  }

  if (orderNumber) {
    const normalizedOrderNumber = orderNumber.toUpperCase()
    const selected = orders.find(
      (order) => order.order_number?.toUpperCase() === normalizedOrderNumber
    )
    if (!selected) throw new ChatbotNotFoundError()
    return selected
  }

  const mentionedOrders = findMentionedOrders(orders, message)

  if (mentionedOrders.length === 1) {
    return mentionedOrders[0]
  }

  if (mentionedOrders.length > 1) {
    return null
  }

  for (const historyMessage of [...history].reverse()) {
    if (historyMessage.role !== 'user') continue

    const previouslyMentionedOrders = findMentionedOrders(
      orders,
      historyMessage.content
    )

    if (previouslyMentionedOrders.length === 1) {
      return previouslyMentionedOrders[0]
    }
  }

  const activeOrders = orders.filter((order) =>
    ACTIVE_ORDER_STATUSES.has(order.status)
  )

  if (activeOrders.length === 1) {
    return activeOrders[0]
  }

  if (orders.length === 1) {
    return orders[0]
  }

  return null
}

function buildProgressSummary({
  order,
  billings,
  payments,
  purchaseOrders,
  purchaseOrderItems,
  supplierDeliveries,
  inventoryBatches,
  labelingTasks,
  stagingTasks,
  shipments,
  predictions,
  documents,
}) {
  const currentBilling = billings[0] || null
  const downPayment = payments.find(
    (payment) => payment.payment_type === 'down_payment'
  )
  const balancePayment = payments.find(
    (payment) => payment.payment_type === 'balance'
  )
  const activePurchaseOrders = purchaseOrders.filter(
    (purchaseOrder) => purchaseOrder.status !== 'cancelled'
  )
  const deliveredPurchaseOrders = activePurchaseOrders.filter(
    (purchaseOrder) => purchaseOrder.status === 'delivered'
  )
  const completedDeliveries = supplierDeliveries.filter((delivery) =>
    ['received', 'with_discrepancy'].includes(delivery.delivery_status)
  )
  const orderedQuantity = purchaseOrderItems.reduce(
    (sum, item) => sum + numberValue(item.quantity_ordered),
    0
  )
  const receivedQuantity = purchaseOrderItems.reduce(
    (sum, item) => sum + numberValue(item.quantity_received),
    0
  )
  const labelingRequired = labelingTasks.reduce(
    (sum, task) => sum + numberValue(task.required_quantity),
    0
  )
  const labelingCompleted = labelingTasks.reduce(
    (sum, task) => sum + numberValue(task.completed_quantity),
    0
  )
  const stagingRequired = stagingTasks.reduce(
    (sum, task) => sum + numberValue(task.required_quantity),
    0
  )
  const stagingCompleted = stagingTasks.reduce(
    (sum, task) => sum + numberValue(task.staged_quantity),
    0
  )
  const currentShipment = shipments[0] || null
  const latestPrediction = predictions[0] || null
  const lifecycleIndex = ORDER_LIFECYCLE.indexOf(order.status)
  const completionPercentage =
    lifecycleIndex < 0
      ? null
      : Math.round(((lifecycleIndex + 1) / ORDER_LIFECYCLE.length) * 100)
  const completedSteps = []
  const remainingSteps = []

  if (
    [
      'payment_verified',
      'procurement_started',
      'partially_received',
      'warehouse_preparation',
      'ready_for_shipment',
      'shipped',
      'completed',
    ].includes(order.status)
  ) {
    completedSteps.push('Payment verification recorded')
  } else if (order.status === 'awaiting_down_payment') {
    remainingSteps.push('Payment verification')
  }

  if (
    activePurchaseOrders.length > 0 &&
    deliveredPurchaseOrders.length === activePurchaseOrders.length
  ) {
    completedSteps.push('Supplier purchase orders delivered')
  } else if (activePurchaseOrders.length > 0) {
    remainingSteps.push('Complete pending supplier deliveries')
  }

  if (receivedQuantity > 0 && receivedQuantity >= orderedQuantity) {
    completedSteps.push('Warehouse receiving recorded')
  } else if (orderedQuantity > receivedQuantity) {
    remainingSteps.push('Complete warehouse receiving')
  }

  if (
    labelingTasks.length > 0 &&
    labelingTasks.every((task) => task.status === 'completed')
  ) {
    completedSteps.push('Labeling completed')
  } else if (labelingTasks.length > 0) {
    remainingSteps.push('Complete labeling')
  }

  if (
    stagingTasks.length > 0 &&
    stagingTasks.every((task) => task.status === 'completed')
  ) {
    completedSteps.push('Warehouse staging completed')
  } else if (stagingTasks.length > 0) {
    remainingSteps.push('Complete warehouse staging')
  }

  if (['shipped', 'completed'].includes(order.status)) {
    completedSteps.push('Shipment dispatched')
  } else if (order.status !== 'cancelled') {
    remainingSteps.push('Finalize shipment preparation')
  }

  const today = new Date().toISOString().slice(0, 10)
  const delayedPurchaseOrders = activePurchaseOrders.filter(
    (purchaseOrder) =>
      purchaseOrder.expected_delivery_date &&
      purchaseOrder.expected_delivery_date < today &&
      purchaseOrder.status !== 'delivered'
  ).length

  return {
    orderNumber: order.order_number,
    currentStatus: friendlyStatus(order.status),
    orderDate: dateOnly(order.order_date),
    confirmationDate: dateOnly(order.confirmed_at),
    estimatedReadyDate: dateOnly(order.estimated_ready_date),
    actualReadyDate: dateOnly(order.actual_ready_date),
    overallCompletionPercentage: completionPercentage,
    payment: currentBilling
      ? {
          billingStatus: friendlyStatus(currentBilling.billing_status),
          downPaymentRequired:
            numberValue(currentBilling.down_payment_required) > 0,
          downPaymentStatus: downPayment
            ? friendlyStatus(downPayment.status)
            : 'Unavailable',
          remainingBalanceStatus:
            numberValue(currentBilling.balance_amount) <= 0
              ? 'Not required'
              : balancePayment
                ? friendlyStatus(balancePayment.status)
                : 'Unavailable',
        }
      : {
          billingStatus: 'Unavailable',
          downPaymentRequired: null,
          downPaymentStatus: 'Unavailable',
          remainingBalanceStatus: 'Unavailable',
        },
    supplierDeliveries: {
      purchaseOrders: activePurchaseOrders.length,
      purchaseOrdersCompleted: deliveredPurchaseOrders.length,
      deliveryRecords: supplierDeliveries.length,
      deliveryRecordsCompleted: completedDeliveries.length,
      orderedQuantity,
      receivedQuantity,
    },
    warehouse: {
      inventoryBatchesRecorded: inventoryBatches.length,
      receivedBatches: inventoryBatches.filter((batch) => batch.received_date)
        .length,
      stagingTaskStatuses: countByStatus(stagingTasks),
      stagedQuantity: stagingCompleted,
      requiredStagingQuantity: stagingRequired,
    },
    labeling: {
      taskStatuses: countByStatus(labelingTasks),
      completedQuantity: labelingCompleted,
      requiredQuantity: labelingRequired,
    },
    documents: {
      customerVisibleCount: documents.length,
      customerVisibleTypes: documents.map((document) =>
        friendlyStatus(document.document_type)
      ),
      statuses: countByStatus(documents),
      note:
        'Only customer-visible uploaded or verified documents are included.',
    },
    shipment: currentShipment
      ? {
          status: friendlyStatus(currentShipment.status),
          scheduledShipDate: dateOnly(currentShipment.estimated_ship_date),
          confirmedShipmentDate: dateOnly(currentShipment.actual_ship_date),
        }
      : {
          status: 'Unavailable',
          scheduledShipDate: null,
          confirmedShipmentDate: null,
        },
    prediction: latestPrediction?.predicted_ready_date
      ? {
          estimatedShipmentReadinessDate: dateOnly(
            latestPrediction.predicted_ready_date
          ),
          generatedAt: dateOnly(latestPrediction.created_at),
          isPrediction: true,
          disclaimer:
            'This is an estimated shipment-readiness date, not a confirmed shipment date or guarantee.',
        }
      : {
          estimatedShipmentReadinessDate: null,
          generatedAt: null,
          isPrediction: false,
          unavailableMessage:
            'An estimated shipment-readiness date is not currently available for this order.',
        },
    completedSteps,
    remainingSteps,
    delayWarning:
      delayedPurchaseOrders > 0
        ? `${delayedPurchaseOrders} supplier purchase order${delayedPurchaseOrders === 1 ? '' : 's'} currently show${delayedPurchaseOrders === 1 ? 's' : ''} a past expected delivery date without completion.`
        : null,
  }
}

async function loadOrderContext(supabase, order) {
  const [
    billingsResult,
    purchaseOrdersResult,
    inventoryResult,
    labelingResult,
    stagingResult,
    shipmentsResult,
    predictionsResult,
    documentsResult,
  ] = await Promise.all([
    supabase
      .from('billings')
      .select(
        'id, billing_status, down_payment_required, balance_amount, created_at'
      )
      .eq('order_id', order.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('purchase_orders')
      .select('id, status, expected_delivery_date')
      .eq('order_id', order.id),
    supabase
      .from('inventory_batches')
      .select('quantity_available, quantity_staged, received_date')
      .eq('order_id', order.id),
    supabase
      .from('labeling_tasks')
      .select('required_quantity, completed_quantity, status')
      .eq('order_id', order.id),
    supabase
      .from('staging_tasks')
      .select('required_quantity, staged_quantity, status')
      .eq('order_id', order.id),
    supabase
      .from('shipments')
      .select('status, estimated_ship_date, actual_ship_date, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('prediction_records')
      .select('predicted_ready_date, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('documents')
      .select('document_type, status, uploaded_at')
      .eq('order_id', order.id)
      .in('status', ['uploaded', 'verified']),
  ])

  const billings = queryFailed(billingsResult, 'billing lookup')
  const purchaseOrders = queryFailed(
    purchaseOrdersResult,
    'purchase order lookup'
  )
  const inventoryBatches = queryFailed(
    inventoryResult,
    'warehouse inventory lookup'
  )
  const labelingTasks = queryFailed(labelingResult, 'labeling lookup')
  const stagingTasks = queryFailed(stagingResult, 'staging lookup')
  const shipments = queryFailed(shipmentsResult, 'shipment lookup')
  const predictions = queryFailed(predictionsResult, 'prediction lookup')
  const documents = queryFailed(documentsResult, 'document lookup')

  const billingIds = billings.map((billing) => billing.id)
  const purchaseOrderIds = purchaseOrders.map(
    (purchaseOrder) => purchaseOrder.id
  )
  const [paymentsResult, purchaseOrderItemsResult, deliveriesResult] =
    await Promise.all([
      billingIds.length
        ? supabase
            .from('payments')
            .select('billing_id, payment_type, status, verified_at')
            .in('billing_id', billingIds)
        : Promise.resolve({ data: [], error: null }),
      purchaseOrderIds.length
        ? supabase
            .from('purchase_order_items')
            .select('purchase_order_id, quantity_ordered, quantity_received')
            .in('purchase_order_id', purchaseOrderIds)
        : Promise.resolve({ data: [], error: null }),
      purchaseOrderIds.length
        ? supabase
            .from('supplier_deliveries')
            .select('purchase_order_id, delivery_status')
            .in('purchase_order_id', purchaseOrderIds)
        : Promise.resolve({ data: [], error: null }),
    ])

  return buildProgressSummary({
    order,
    billings,
    payments: queryFailed(paymentsResult, 'payment lookup'),
    purchaseOrders,
    purchaseOrderItems: queryFailed(
      purchaseOrderItemsResult,
      'purchase order item lookup'
    ),
    supplierDeliveries: queryFailed(
      deliveriesResult,
      'supplier delivery lookup'
    ),
    inventoryBatches,
    labelingTasks,
    stagingTasks,
    shipments,
    predictions,
    documents,
  })
}

export async function getCustomerOrderContext({
  supabase,
  user,
  orderId,
  orderNumber,
  message,
  history = [],
}) {
  const orders = await loadCustomerOrders(supabase, user)
  const selectedOrder = chooseOrder(orders, {
    orderId,
    orderNumber,
    message,
    history,
  })

  if (!selectedOrder) {
    return {
      orderContext: null,
      availableOrderNumbers: orders
        .map((order) => order.order_number)
        .filter(Boolean),
    }
  }

  return {
    orderContext: await loadOrderContext(supabase, selectedOrder),
    availableOrderNumbers: orders
      .map((order) => order.order_number)
      .filter(Boolean),
  }
}
