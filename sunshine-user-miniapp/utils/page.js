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

module.exports = {
  runExclusive,
  runGuarded
}
