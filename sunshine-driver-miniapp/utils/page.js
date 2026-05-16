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
  runGuarded
}
