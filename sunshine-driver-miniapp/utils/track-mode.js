const TRACK_MODE = {
  DEMO: 'DEMO',
  REAL: 'REAL'
}

const TRACK_MODE_OPTIONS = [
  {
    value: TRACK_MODE.DEMO,
    label: '演示',
    desc: '司机接单后显示在上车点附近，并按模拟路线接驾。'
  },
  {
    value: TRACK_MODE.REAL,
    label: '真实',
    desc: '使用司机手机实际定位作为接驾位置并同步轨迹。'
  }
]

function normalizeTrackMode(value) {
  return value === TRACK_MODE.REAL ? TRACK_MODE.REAL : TRACK_MODE.DEMO
}

function getTrackModeLabel(value) {
  const mode = normalizeTrackMode(value)
  const option = TRACK_MODE_OPTIONS.find((item) => item.value === mode)
  return option ? option.label : '演示'
}

function getTrackModeDesc(value) {
  const mode = normalizeTrackMode(value)
  const option = TRACK_MODE_OPTIONS.find((item) => item.value === mode)
  return option ? option.desc : TRACK_MODE_OPTIONS[0].desc
}

function getCurrentTrackMode() {
  const app = typeof getApp === 'function' ? getApp() : null
  const settings = app && app.globalData && app.globalData.driverStore
    ? app.globalData.driverStore.settings || {}
    : {}
  return normalizeTrackMode(settings.trackMode)
}

function isDemoTrackMode(value) {
  return normalizeTrackMode(value !== undefined ? value : getCurrentTrackMode()) === TRACK_MODE.DEMO
}

module.exports = {
  TRACK_MODE,
  TRACK_MODE_OPTIONS,
  getCurrentTrackMode,
  getTrackModeDesc,
  getTrackModeLabel,
  isDemoTrackMode,
  normalizeTrackMode
}
