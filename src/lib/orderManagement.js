import { supabase } from '@/lib/supabaseClient'

const TABLES = [
  'customers',
  'suppliers',
  'customer_orders',
  'customer_order_items',
  'purchase_orders',
  'purchase_order_items',
  'products',
  'inventory_batches',
  'shipments',
  'billings',
]

const ID_COLUMNS = {
  customers: ['id', 'uuid', 'customer_id'],
  suppliers: ['id', 'uuid', 'supplier_id', 'vendor_id'],
  customer_orders: ['id', 'uuid', 'customer_order_id', 'order_id'],
  customer_order_items: ['id', 'uuid', 'customer_order_item_id', 'order_item_id'],
  purchase_orders: ['id', 'uuid', 'purchase_order_id', 'po_id', 'order_id'],
  purchase_order_items: ['id', 'uuid', 'purchase_order_item_id', 'po_item_id'],
  products: ['id', 'uuid', 'product_id', 'sku'],
  inventory_batches: ['id', 'uuid', 'inventory_batch_id', 'batch_id'],
  shipments: ['id', 'uuid', 'shipment_id'],
  billings: ['id', 'uuid', 'billing_id'],
}

const first = (record, keys, fallback = '') => {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') {
      return record[key]
    }
  }
  return fallback
}

const idKeysFor = (table) => ID_COLUMNS[table] || ['id', 'uuid']

const idColumnOf = (record, table) => {
  if (record?.idColumn) return record.idColumn
  return idKeysFor(table).find((key) => record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '')
}

export const idOf = (record, table) => first(record, idKeysFor(table))

export const formatDate = (value) => {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString()
}

export const money = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
  })

const numberOf = (value) => Number(value || 0)

const normalizeStatus = (value) =>
  String(value || 'Pending')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const isCompleteStatus = (value) => {
  const status = String(value || '').toLowerCase()
  return ['complete', 'completed', 'delivered', 'ready for shipment', 'fulfilled'].includes(status)
}

const readTable = async (tableName) => {
  const { data, error } = await supabase.from(tableName).select('*')
  if (error) {
    throw new Error(`${tableName}: ${error.message}`)
  }
  return data || []
}

export async function fetchOrderManagementData() {
  const results = await Promise.all(TABLES.map((table) => readTable(table)))
  const raw = Object.fromEntries(TABLES.map((table, index) => [table, results[index]]))
  return buildOrderManagementData(raw)
}

export function buildOrderManagementData(raw) {
  const customers = raw.customers || []
  const suppliers = raw.suppliers || []
  const customerOrders = raw.customer_orders || []
  const customerOrderItems = raw.customer_order_items || []
  const purchaseOrders = raw.purchase_orders || []
  const purchaseOrderItems = raw.purchase_order_items || []
  const products = raw.products || []
  const inventoryBatches = raw.inventory_batches || []
  const shipments = raw.shipments || []
  const billings = raw.billings || []

  const normalizedCustomers = customers.map((customer) => ({
    ...customer,
    id: idOf(customer, 'customers'),
    idColumn: idColumnOf(customer, 'customers'),
    name: first(customer, ['name', 'customer_name', 'company_name'], `Customer ${idOf(customer, 'customers')}`),
  }))

  const normalizedSuppliers = suppliers.map((supplier) => ({
    ...supplier,
    id: idOf(supplier, 'suppliers'),
    idColumn: idColumnOf(supplier, 'suppliers'),
    name: first(supplier, ['supplier_name', 'name', 'company_name', 'vendor_name'], `Supplier ${idOf(supplier)}`),
  }))

  const customerById = new Map(normalizedCustomers.map((customer) => [String(customer.id), customer]))
  const supplierById = new Map(normalizedSuppliers.map((supplier) => [String(supplier.id), supplier]))
  const customerOrderById = new Map(customerOrders.map((order) => [String(idOf(order, 'customer_orders')), order]))
  const productById = new Map(products.map((product) => [String(idOf(product, 'products')), product]))
  const billingByOrderId = new Map(billings.map((billing) => [String(first(billing, ['order_id'])), {
    ...billing,
    id: idOf(billing, 'billings'),
    idColumn: idColumnOf(billing, 'billings'),
  }]))

  const deliveredByPoItem = new Map()
  inventoryBatches.forEach((batch) => {
    const poItemId = first(batch, ['purchase_order_item_id', 'po_item_id'])
    if (!poItemId) return
    deliveredByPoItem.set(
      String(poItemId),
      (deliveredByPoItem.get(String(poItemId)) || 0) + numberOf(first(batch, ['quantity', 'received_quantity', 'delivered_quantity'], 0)),
    )
  })

  const normalizedPurchaseItems = purchaseOrderItems.map((item) => {
    const orderedQuantity = numberOf(first(item, ['ordered_quantity', 'quantity', 'qty'], 0))
    const deliveredQuantity = numberOf(
      first(item, ['delivered_quantity', 'received_quantity', 'fulfilled_quantity'], deliveredByPoItem.get(String(idOf(item))) || 0),
    )
    const remainingQuantity = Math.max(orderedQuantity - deliveredQuantity, 0)
    const product = productById.get(String(first(item, ['product_id'])))

    return {
      ...item,
      id: idOf(item, 'purchase_order_items'),
      idColumn: idColumnOf(item, 'purchase_order_items'),
      purchaseOrderId: first(item, ['purchase_order_id', 'po_id']),
      customerOrderItemId: first(item, ['customer_order_item_id', 'order_item_id']),
      productName: first(product, ['name', 'product_name', 'description'], first(item, ['product_name', 'description'], 'Product')),
      orderedQuantity,
      deliveredQuantity,
      remainingQuantity,
      deliveryStatus: remainingQuantity <= 0 && orderedQuantity > 0 ? 'Complete' : deliveredQuantity > 0 ? 'Partial' : 'Pending',
      progress: orderedQuantity > 0 ? Math.min(Math.round((deliveredQuantity / orderedQuantity) * 100), 100) : 0,
    }
  })

  const purchaseItemsByPo = new Map()
  normalizedPurchaseItems.forEach((item) => {
    const key = String(item.purchaseOrderId || '')
    purchaseItemsByPo.set(key, [...(purchaseItemsByPo.get(key) || []), item])
  })

  const normalizedPurchaseOrders = purchaseOrders.map((po) => {
    const poId = idOf(po, 'purchase_orders')
    const items = purchaseItemsByPo.get(String(poId)) || []
    const ordered = items.reduce((sum, item) => sum + item.orderedQuantity, 0)
    const delivered = items.reduce((sum, item) => sum + item.deliveredQuantity, 0)
    const progress = ordered > 0 ? Math.min(Math.round((delivered / ordered) * 100), 100) : 0
    const supplierId = first(po, ['supplier_id', 'vendor_id'])
    const supplierRecord = supplierById.get(String(supplierId))
    const supplier = first(supplierRecord, ['supplier_name', 'name', 'company_name', 'vendor_name'], first(po, ['supplier_name', 'supplier', 'vendor_name'], 'Supplier'))
    const status = normalizeStatus(
      first(po, ['status'], progress >= 100 ? 'Delivered' : progress > 0 ? 'Partially Delivered' : 'Pending'),
    )
    const customerOrderId = first(po, ['customer_order_id', 'order_id'])
    const customerOrder = customerOrderById.get(String(customerOrderId))

    return {
      ...po,
      id: poId,
      idColumn: idColumnOf(po, 'purchase_orders'),
      poNumber: first(po, ['po_number', 'purchase_order_number', 'order_number', 'reference_number'], `PO-${poId}`),
      supplierId,
      supplier,
      dateIssued: first(po, ['created_at']),
      expectedDelivery: first(po, ['expected_delivery_date', 'expected_delivery', 'delivery_date']),
      status,
      progress,
      items,
      customerOrderId,
      customerOrderNumber: first(customerOrder, ['order_number', 'customer_order_number', 'reference_number'], customerOrderId ? `ORD-${customerOrderId}` : ''),
    }
  })

  const purchaseOrdersById = new Map(normalizedPurchaseOrders.map((po) => [String(po.id), po]))
  const orderItemsByCustomerOrder = new Map()
  customerOrderItems.forEach((item) => {
    const key = String(first(item, ['customer_order_id', 'order_id']))
    orderItemsByCustomerOrder.set(key, [...(orderItemsByCustomerOrder.get(key) || []), item])
  })

  const normalizedCustomerOrders = customerOrders.map((order) => {
    const orderId = idOf(order, 'customer_orders')
    const customer = customerById.get(String(first(order, ['customer_id'])))
    const items = (orderItemsByCustomerOrder.get(String(orderId)) || []).map((item) => {
      const product = productById.get(String(first(item, ['product_id'])))
      const quantity = numberOf(first(item, ['quantity_ordered', 'quantity', 'ordered_quantity', 'qty'], 0))
      const unitPrice = numberOf(first(item, ['unit_price', 'price'], 0))

      return {
        ...item,
        id: idOf(item, 'customer_order_items'),
        idColumn: idColumnOf(item, 'customer_order_items'),
        productName: first(product, ['name', 'product_name', 'description'], first(item, ['product_name', 'description'], 'Product')),
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      }
    })
    const itemIds = new Set(items.map((item) => String(item.id)))
    const linkedPurchaseOrders = normalizedPurchaseOrders.filter((po) => {
      if (String(po.customerOrderId || '') === String(orderId)) return true
      return po.items.some((item) => itemIds.has(String(item.customerOrderItemId || '')))
    })
    const progress = linkedPurchaseOrders.length
      ? Math.round(linkedPurchaseOrders.reduce((sum, po) => sum + po.progress, 0) / linkedPurchaseOrders.length)
      : isCompleteStatus(first(order, ['status'])) ? 100 : 0
    const completionStatus = progress >= 100 ? 'Ready for Shipment' : 'Awaiting Supplier Deliveries'
    const shipment = shipments.find((entry) => String(first(entry, ['customer_order_id', 'order_id'])) === String(orderId))
    const billing = billingByOrderId.get(String(orderId)) || null
    const rawStatus = String(first(order, ['status'], '')).toLowerCase()
    const validUntil = billing?.valid_until ? new Date(billing.valid_until) : null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const pfiState = rawStatus === 'submitted'
      ? validUntil && validUntil < today
        ? 'Expired'
        : billing
          ? 'Sent to customer'
          : 'Pending review'
      : rawStatus === 'cancelled'
        ? 'Cancelled'
        : 'Approved'

    return {
      ...order,
      id: orderId,
      idColumn: idColumnOf(order, 'customer_orders'),
      orderNumber: first(order, ['order_number', 'customer_order_number', 'reference_number'], `ORD-${orderId}`),
      customerName: first(customer, ['name', 'customer_name', 'company_name'], first(order, ['customer_name'], 'Customer')),
      contactInfo: first(customer, ['contact_info', 'email', 'phone', 'contact_number'], 'Not set'),
      orderDate: first(order, ['order_date', 'created_at', 'date']),
      expectedShipmentDate: first(order, ['expected_shipment_date', 'estimated_ready_date', 'shipment_date', 'required_date']),
      status: normalizeStatus(first(order, ['status'], completionStatus)),
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      items,
      linkedPurchaseOrders,
      progress,
      completionStatus,
      shipment,
      billing,
      pfiState,
    }
  })

  const supplierDeliveries = normalizedPurchaseItems.map((item) => {
    const po = purchaseOrdersById.get(String(item.purchaseOrderId))
    return {
      ...item,
      supplier: po?.supplier || 'Supplier',
      poNumber: po?.poNumber || 'Purchase Order',
    }
  })

  return {
    customers: normalizedCustomers,
    suppliers: normalizedSuppliers,
    customerOrders: normalizedCustomerOrders,
    purchaseOrders: normalizedPurchaseOrders,
    supplierDeliveries,
    products,
    summary: {
      totalCustomerOrders: normalizedCustomerOrders.length,
      pendingOrders: normalizedCustomerOrders.filter((order) => order.status.toLowerCase() === 'pending').length,
      ordersInProgress: normalizedCustomerOrders.filter((order) =>
        ['processing', 'in progress', 'awaiting supplier deliveries'].includes(order.status.toLowerCase()),
      ).length,
      completedOrders: normalizedCustomerOrders.filter((order) => order.progress >= 100 || isCompleteStatus(order.status)).length,
      totalPurchaseOrders: normalizedPurchaseOrders.length,
      supplierDeliveriesPending: supplierDeliveries.filter((item) => item.deliveryStatus !== 'Complete').length,
    },
  }
}

export async function createRecord(table, payload) {
  let nextPayload = { ...payload }

  // Auto-generate Purchase Order Number
  if (table === 'purchase_orders') {
    const year = new Date().getFullYear()

    const { data: latestPO, error } = await supabase
      .from('purchase_orders')
      .select('po_number')
      .ilike('po_number', `PO-${year}-%`)
      .order('po_number', { ascending: false })
      .limit(1)

    if (error) throw new Error(error.message)

    let nextNumber = 901

    if (latestPO && latestPO.length > 0) {
      const current = parseInt(latestPO[0].po_number.split('-')[2], 10)
      nextNumber = current + 1
    }

    nextPayload.po_number = `PO-${year}-${nextNumber}`
  }

  return writeRecord(nextPayload, (payload) =>
    supabase
      .from(table)
      .insert(payload)
      .select()
      .single()
  )
}

export async function updateRecord(table, id, payload) {
  const target = mutationTarget(table, id)
  return writeRecord(payload, (nextPayload) => supabase.from(table).update(nextPayload).eq(target.column, target.value))
}

export async function deleteRecord(table, id) {
  const target = mutationTarget(table, id)
  const { error } = await supabase.from(table).delete().eq(target.column, target.value)
  if (error) throw new Error(error.message)
}

function mutationTarget(table, recordOrId) {
  if (recordOrId && typeof recordOrId === 'object') {
    const column = idColumnOf(recordOrId, table)
    const value = idOf(recordOrId, table)
    return { column: column || 'id', value }
  }

  return { column: 'id', value: recordOrId }
}

const missingColumnFrom = (message) => {
  const match = String(message || '').match(/Could not find the '([^']+)' column/)
  return match?.[1]
}

async function writeRecord(payload, write) {
  const nextPayload = { ...payload }
  const skippedColumns = []

  while (Object.keys(nextPayload).length > 0) {
    const { data, error } = await write(nextPayload)

    if (!error) {
      return {
        data,
        skippedColumns,
      }
    }

    const missingColumn = missingColumnFrom(error.message)
    if (!missingColumn || !(missingColumn in nextPayload)) {
      throw new Error(error.message)
    }

    delete nextPayload[missingColumn]
    skippedColumns.push(missingColumn)
  }

  throw new Error('No valid columns were available to save this record.')
}
