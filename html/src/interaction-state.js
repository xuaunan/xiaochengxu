export function orderActionPendingKey(action, order = {}) {
  const orderId = String(order?.id || order?.orderNo || '').trim()
  const actionName = String(action || '').trim()
  return actionName && orderId ? `${actionName}:${orderId}` : ''
}

export function isOrderActionPending(pendingKey, action, order = {}) {
  const targetKey = orderActionPendingKey(action, order)
  return Boolean(targetKey && pendingKey === targetKey)
}

export function isAnyOrderActionPending(pendingKey, order = {}) {
  const orderId = String(order?.id || order?.orderNo || '').trim()
  return Boolean(orderId && String(pendingKey || '').endsWith(`:${orderId}`))
}
