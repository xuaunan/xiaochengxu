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

function restoreSilkyLeavingState(context, key = 'pageLeaving') {
  if (!context || typeof context.setData !== 'function') {
    return
  }
  context.__silkyNavigating = false
  context.setData({
    [key]: false,
    pageReady: true
  })
}

function runSilkyAction(context, action, options = {}) {
  const duration = Number(options.duration !== undefined ? options.duration : 160)
  const key = options.key || 'pageLeaving'
  const selector = options.selector === undefined ? '.page-shell' : options.selector
  const beforeLeave = typeof options.beforeLeave === 'function' ? options.beforeLeave : null

  if (typeof action !== 'function') {
    return Promise.resolve(null)
  }

  if (!context || typeof context.setData !== 'function') {
    return Promise.resolve().then(() => action())
  }

  if (context.__silkyNavigating) {
    return Promise.resolve(null)
  }

  context.__silkyNavigating = true
  if (beforeLeave) {
    beforeLeave()
  }
  context.setData({ [key]: true })
  clearTimeout(context.__silkyLeaveTimer)
  clearTimeout(context.__silkyLeaveFallbackTimer)

  return new Promise((resolve, reject) => {
    let executed = false

    const execute = () => {
      if (executed) return
      executed = true

      try {
        Promise.resolve(action())
          .then(resolve)
          .catch((error) => {
            restoreSilkyLeavingState(context, key)
            reject(error)
          })
      } catch (error) {
        restoreSilkyLeavingState(context, key)
        reject(error)
      }
    }

    if (selector && typeof context.animate === 'function') {
      context.animate(selector, [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0.86, transform: 'translateY(6rpx) scale(0.996)' }
      ], duration, execute)
      context.__silkyLeaveFallbackTimer = setTimeout(execute, duration + 60)
      return
    }

    context.__silkyLeaveTimer = setTimeout(execute, duration)
  })
}

function createSilkyNavigation(context, method, wxOptions = {}, transitionOptions = {}) {
  const options = wxOptions || {}
  const originalSuccess = options.success
  const originalFail = options.fail
  const originalComplete = options.complete
  const key = transitionOptions.key || 'pageLeaving'

  return runSilkyAction(context, () => {
    return new Promise((resolve) => {
      wx[method]({
        ...options,
        success: (res) => {
          if (typeof originalSuccess === 'function') {
            originalSuccess(res)
          }
          if (context) {
            clearTimeout(context.__silkyRestoreAfterNavTimer)
            context.__silkyRestoreAfterNavTimer = setTimeout(() => {
              restoreSilkyLeavingState(context, key)
            }, 260)
          }
          resolve(res)
        },
        fail: (error) => {
          restoreSilkyLeavingState(context, key)
          if (typeof originalFail === 'function') {
            originalFail(error)
          }
          resolve(null)
        },
        complete: (res) => {
          if (typeof originalComplete === 'function') {
            originalComplete(res)
          }
        }
      })
    })
  }, transitionOptions)
}

function navigateToSilky(context, options = {}, transitionOptions = {}) {
  return createSilkyNavigation(context, 'navigateTo', options, transitionOptions)
}

function redirectToSilky(context, options = {}, transitionOptions = {}) {
  return createSilkyNavigation(context, 'redirectTo', options, transitionOptions)
}

function reLaunchSilky(context, options = {}, transitionOptions = {}) {
  return createSilkyNavigation(context, 'reLaunch', options, transitionOptions)
}

function switchTabSilky(context, options = {}, transitionOptions = {}) {
  return createSilkyNavigation(context, 'switchTab', options, transitionOptions)
}

function navigateBackSilky(context, options = {}) {
  const delta = Number(options.delta || 1)
  const duration = Number(options.duration !== undefined ? options.duration : 160)
  const key = options.key || 'pageLeaving'
  const selector = options.selector || ''
  const beforeLeave = typeof options.beforeLeave === 'function' ? options.beforeLeave : null
  const onFail = typeof options.fail === 'function' ? options.fail : null

  const restoreLeavingState = () => {
    if (context && typeof context.setData === 'function') {
      context.setData({
        [key]: false,
        pageReady: true
      })
    }
  }

  const doNavigateBack = () => {
    wx.navigateBack({
      delta,
      success: () => {},
      fail: (error) => {
        restoreLeavingState()
        if (onFail) {
          onFail(error)
        }
      }
    })
  }

  if (beforeLeave) {
    beforeLeave()
  }

  if (!context || typeof context.setData !== 'function') {
    wx.navigateBack({ delta })
    return null
  }

  context.setData({ [key]: true })
  clearTimeout(context.__silkyLeaveTimer)

  if (selector && typeof context.animate === 'function') {
    context.animate(selector, [
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0.84, transform: 'translateY(5rpx) scale(0.998)' }
    ], duration, () => {
      doNavigateBack()
    })
    return null
  }

  context.__silkyLeaveTimer = setTimeout(() => {
    doNavigateBack()
  }, duration)
  return context.__silkyLeaveTimer
}

function clearSilkyTransitionTimers(context) {
  if (!context) return
  clearTimeout(context.__silkyEnterTimer)
  clearTimeout(context.__silkyLeaveTimer)
  clearTimeout(context.__silkyLeaveFallbackTimer)
  clearTimeout(context.__silkyRestoreAfterNavTimer)
  context.__silkyNavigating = false
}

module.exports = {
  clearSilkyTransitionTimers,
  markSilkyPageReady,
  navigateBackSilky,
  navigateToSilky,
  redirectToSilky,
  reLaunchSilky,
  runExclusive,
  runGuarded,
  runSilkyAction,
  switchTabSilky
}
