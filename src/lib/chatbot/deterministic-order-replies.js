import { getResponseGuidance } from './system-instructions.js'

function joinItems(items) {
  if (items.length <= 1) return items[0] || ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

export function getDeterministicOrderReply({
  message,
  orderContext,
  availableOrderNumbers = [],
}) {
  const { intent } = getResponseGuidance(message)

  if (intent === 'focused_answer') return null

  if (!orderContext) {
    return availableOrderNumbers.length > 0
      ? 'Please select an order from the dropdown above so I can answer that question.'
      : 'There are no orders currently available for your account.'
  }

  const orderNumber = orderContext.orderNumber

  if (intent === 'estimated_readiness') {
    if (orderContext.actualReadyDate) {
      return `Order ${orderNumber} was recorded as ready on ${orderContext.actualReadyDate}.`
    }

    if (orderContext.estimatedReadyDate) {
      return `The estimated shipment-readiness date for order ${orderNumber} is ${orderContext.estimatedReadyDate}. This is an estimate, not a confirmed shipment date or guarantee.`
    }

    const estimatedDate =
      orderContext.prediction?.estimatedShipmentReadinessDate

    if (estimatedDate) {
      return `The estimated shipment-readiness date for order ${orderNumber} is ${estimatedDate}. This is an estimate, not a confirmed shipment date or guarantee.`
    }

    const delay = orderContext.delayWarning
      ? ` ${orderContext.delayWarning} This may affect the timeline.`
      : ''

    return `An estimated shipment-readiness date is not currently available for order ${orderNumber}.${delay}`
  }

  if (intent === 'payment') {
    const payment = orderContext.payment
    return `For order ${orderNumber}, the down payment status is ${payment.downPaymentStatus} and the remaining balance status is ${payment.remainingBalanceStatus}.`
  }

  if (intent === 'supplier_delivery') {
    const deliveries = orderContext.supplierDeliveries
    const delay = orderContext.delayWarning
      ? ` ${orderContext.delayWarning}`
      : ''

    return `${deliveries.purchaseOrdersCompleted} of ${deliveries.purchaseOrders} supplier purchase orders for order ${orderNumber} are recorded as completed.${delay}`
  }

  if (intent === 'labeling') {
    const labeling = orderContext.labeling
    const completed =
      labeling.requiredQuantity > 0 &&
      labeling.completedQuantity >= labeling.requiredQuantity

    return completed
      ? `Labeling is recorded as completed for order ${orderNumber}.`
      : `Labeling is not yet recorded as completed for order ${orderNumber}.`
  }

  if (intent === 'documents') {
    const count = orderContext.documents.customerVisibleCount
    return count > 0
      ? `${count} customer-visible document${count === 1 ? ' is' : 's are'} currently available for order ${orderNumber}.`
      : `No customer-visible documents are currently available for order ${orderNumber}.`
  }

  if (intent === 'remaining_steps') {
    const remaining = orderContext.remainingSteps
    return remaining.length > 0
      ? `The remaining steps for order ${orderNumber} are ${joinItems(remaining)}.`
      : `No incomplete preparation steps are currently recorded for order ${orderNumber}.`
  }

  if (intent === 'status_overview') {
    const percentage =
      orderContext.overallCompletionPercentage === null
        ? ''
        : `, with ${orderContext.overallCompletionPercentage} percent overall completion`
    const remaining =
      orderContext.remainingSteps.length > 0
        ? ` The next recorded steps are ${joinItems(orderContext.remainingSteps)}.`
        : ''
    const delay = orderContext.delayWarning
      ? ` ${orderContext.delayWarning}`
      : ''

    return `Order ${orderNumber} is currently ${orderContext.currentStatus}${percentage}.${remaining}${delay}`
  }

  return null
}
