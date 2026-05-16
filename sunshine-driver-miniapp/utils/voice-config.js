const VOICE_STYLE_OPTIONS = [
  { value: 'default', label: '播音声音', audioDirectory: 'default', audioExtension: '.mp3' },
  { value: 'original-default', label: '默认声音', audioDirectory: '', audioExtension: '.wav' },
  { value: 'gentle-female', label: '亲切自然女声', audioExtension: '.mp3' },
  { value: 'sunny-energetic', label: '阳光活力男声', audioExtension: '.mp3' },
  { value: 'mature-man', label: '稳重大叔声音', audioExtension: '.mp3' },
  { value: 'playful', label: '儿童声音', audioExtension: '.mp3' },
  { value: 'original-playful', label: '搞怪声音', audioDirectory: 'playful', audioExtension: '.wav' }
]

const VOICE_STYLE_MAP = VOICE_STYLE_OPTIONS.reduce((result, item) => {
  result[item.value] = item
  return result
}, {})

function normalizeVoiceStyle(value) {
  return VOICE_STYLE_MAP[value] ? value : 'default'
}

function getVoiceStyleLabel(value) {
  return (VOICE_STYLE_MAP[normalizeVoiceStyle(value)] || VOICE_STYLE_MAP.default).label
}

function resolveVoiceAudioPath(audioPath, voiceStyle) {
  if (!audioPath) return ''
  const normalizedStyle = normalizeVoiceStyle(voiceStyle)
  const segments = `${audioPath}`.split('/')
  const style = VOICE_STYLE_MAP[normalizedStyle] || {}
  const audioDirectory = style.audioDirectory !== undefined ? style.audioDirectory : normalizedStyle
  const filename = segments[segments.length - 1].replace(/\.[^.]+$/, style.audioExtension || '$&')
  return audioDirectory ? `/audio/voices/${audioDirectory}/${filename}` : `/audio/${filename}`
}

module.exports = {
  VOICE_STYLE_OPTIONS,
  getVoiceStyleLabel,
  normalizeVoiceStyle,
  resolveVoiceAudioPath
}
