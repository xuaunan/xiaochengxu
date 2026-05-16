function createDefaultAudioContext() {
  if (typeof wx === 'undefined' || !wx.createInnerAudioContext) {
    return null
  }
  return wx.createInnerAudioContext()
}

function createVoicePlayer(audioFactory = createDefaultAudioContext) {
  const queue = []
  let currentAudio = null
  let playing = false

  function cleanupCurrentAudio() {
    if (!currentAudio) return
    try {
      if (currentAudio.stop) {
        currentAudio.stop()
      }
    } catch (error) {
    }
    try {
      if (currentAudio.destroy) {
        currentAudio.destroy()
      }
    } catch (error) {
    }
    currentAudio = null
  }

  function playNext() {
    if (playing) return
    const task = queue.shift()
    if (!task) return

    const audio = audioFactory()
    if (!audio) {
      task.reject(new Error('AUDIO_UNAVAILABLE'))
      setTimeout(playNext, 0)
      return
    }

    let settled = false
    playing = true
    currentAudio = audio

    const settle = (error) => {
      if (settled) return
      settled = true
      cleanupCurrentAudio()
      playing = false
      if (error) {
        task.reject(error)
      } else {
        task.resolve()
      }
      setTimeout(playNext, 0)
    }

    audio.src = task.audioPath
    audio.obeyMuteSwitch = false
    audio.volume = typeof task.volume === 'number' ? task.volume : 1

    if (audio.onEnded) {
      audio.onEnded(() => settle())
    }
    if (audio.onError) {
      audio.onError((error) => settle(error || new Error('AUDIO_PLAY_ERROR')))
    }

    try {
      audio.play()
    } catch (error) {
      settle(error)
    }
  }

  return {
    enqueue(audioPath, options = {}) {
      return new Promise((resolve, reject) => {
        if (!audioPath) {
          reject(new Error('AUDIO_UNAVAILABLE'))
          return
        }
        queue.push({
          audioPath,
          resolve,
          reject,
          volume: options.volume
        })
        playNext()
      })
    },

    getState() {
      return {
        playing,
        queueLength: queue.length,
        currentAudioPath: currentAudio ? currentAudio.src || '' : ''
      }
    },

    reset() {
      queue.length = 0
      playing = false
      cleanupCurrentAudio()
    }
  }
}

const sharedVoicePlayer = createVoicePlayer()

function enqueueVoiceAudio(audioPath, options) {
  return sharedVoicePlayer.enqueue(audioPath, options)
}

function getVoicePlaybackState() {
  return sharedVoicePlayer.getState()
}

function resetVoicePlaybackQueue() {
  sharedVoicePlayer.reset()
}

module.exports = {
  createVoicePlayer,
  enqueueVoiceAudio,
  getVoicePlaybackState,
  resetVoicePlaybackQueue
}
