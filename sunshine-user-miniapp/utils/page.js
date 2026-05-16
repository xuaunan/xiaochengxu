function runExclusive(context, key, task) {
  if (!context || typeof task !== 'function') {
    return Promise.resolve()
  }

  if (context[key]) {
    return context[key]
  }

  const promise = Promise.resolve()
    .then(() => task())
    .finally(() => {
      if (context[key] === promise) {
        context[key] = null
      }
    })

  context[key] = promise
  return promise
}

async function runGuarded(context, key, task) {
  if (!context || typeof task !== 'function') {
    return null
  }

  if (context[key]) {
    return null
  }

  context[key] = true
  try {
    return await task()
  } finally {
    context[key] = false
  }
}

function markSilkyPageReady(context, options = {}) {
  if (!context || typeof context.setData !== 'function') {
    return null
  }

  const key = options.key || 'pageReady'
  const delay = Number(options.delay !== undefined ? options.delay : 24)
  clearTimeout(context.__silkyEnterTimer)
  context.__silkyEnterTimer = setTimeout(() => {
    context.setData({ [key]: true })
  }, delay)
  return context.__silkyEnterTimer
}

function navigateBackSilky(context, options = {}) {
  const delta = Number(options.delta || 1)
  const duration = Number(options.duration !== undefined ? options.duration : 160)
  const key = options.key || 'pageLeaving'
  const beforeLeave = typeof options.beforeLeave === 'function' ? options.beforeLeave : null

  if (beforeLeave) {
    beforeLeave()
  }

  if (!context || typeof context.setData !== 'function') {
    wx.navigateBack({ delta })
    return null
  }

  context.setData({ [key]: true })
  clearTimeout(context.__silkyLeaveTimer)
  context.__silkyLeaveTimer = setTimeout(() => {
    wx.navigateBack({ delta })
  }, duration)
  return context.__silkyLeaveTimer
}

function clearSilkyTransitionTimers(context) {
  if (!context) return
  clearTimeout(context.__silkyEnterTimer)
  clearTimeout(context.__silkyLeaveTimer)
}

module.exports = {
  clearSilkyTransitionTimers,
  markSilkyPageReady,
  navigateBackSilky,
  runExclusive,
  runGuarded
}
