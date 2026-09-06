const fs = require('fs')
const path = require('path')
const vm = require('vm')

const rootDir = path.join(__dirname, '..')
const workspaceRoot = path.join(rootDir, '..')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function createModuleStub() {
  const noop = () => ({})
  return new Proxy({}, {
    get(target, key) {
      if (key === 'ORDER_STATUS') {
        return {
          ACCEPTED: 'ACCEPTED',
          PICKING_UP: 'PICKING_UP',
          IN_TRIP: 'IN_TRIP',
          FINISHED: 'FINISHED',
          CANCELLED: 'CANCELLED'
        }
      }
      if (key === 'TRACK_MODE') {
        return { DEMO: 'DEMO', REAL: 'REAL' }
      }
      return noop
    }
  })
}

function loadPage(relativePath) {
  let pageDefinition = null
  const scheduled = []
  const cleared = []
  const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
  const context = {
    console,
    Date,
    Promise,
    require: createModuleStub,
    getApp: () => ({ globalData: { driverStore: {} } }),
    Page: (definition) => {
      pageDefinition = definition
    },
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: (callback, delay) => {
      const timer = { callback, delay }
      scheduled.push(timer)
      return timer
    },
    clearTimeout: (timer) => {
      cleared.push(timer)
    },
    wx: {}
  }

  vm.runInNewContext(source, context, { filename: relativePath })
  assert(pageDefinition, `Page was not registered: ${relativePath}`)

  const page = {
    ...pageDefinition,
    data: JSON.parse(JSON.stringify(pageDefinition.data)),
    setData(update) {
      Object.assign(this.data, update)
    }
  }
  return { page, scheduled, cleared }
}

function verifyFollowInteraction(relativePath, currentPointKey) {
  const { page, scheduled } = loadPage(relativePath)
  assert(page.data.mapFollowMode === true, `${relativePath}: map follow should be enabled by default`)
  assert(typeof page.handleMapRegionChange === 'function', `${relativePath}: missing region-change handler`)
  assert(typeof page.restoreVehicleView === 'function', `${relativePath}: missing locator action`)

  page.handleMapRegionChange({ detail: { causedBy: 'gesture', type: 'begin' } })
  assert(page.data.mapFollowMode === false, `${relativePath}: gesture begin should pause map follow`)
  assert(scheduled.length === 0, `${relativePath}: gesture begin must not start the restore countdown`)

  page.handleMapRegionChange({ detail: { causedBy: 'gesture', type: 'end' } })
  assert(scheduled.length === 1, `${relativePath}: gesture end should schedule one restore`)
  assert(scheduled[0].delay === 10000, `${relativePath}: restore delay must be 10 seconds after gesture end`)

  page.data.mapFollowMode = true
  page.handleMapRegionChange({ detail: { causedBy: 'update', type: 'begin' } })
  assert(page.data.mapFollowMode === true, `${relativePath}: programmatic updates must keep map follow enabled`)

  const manualCenter = { latitude: 30.1, longitude: 120.1 }
  page.data.mapFollowMode = false
  page.data.mapCenter = manualCenter
  if (typeof page.applyOrderView === 'function') {
    page.applyOrderView({
      start: { latitude: 31, longitude: 121 },
      currentPoint: { latitude: 31.2, longitude: 121.4 }
    })
  } else {
    page.buildDashboardMapData({ latitude: 31.2, longitude: 121.4 })
  }
  assert(page.data.mapCenter.latitude === manualCenter.latitude, `${relativePath}: polling must preserve a manually moved viewport`)
  assert(page.data.mapCenter.longitude === manualCenter.longitude, `${relativePath}: polling must preserve a manually moved viewport`)

  const currentPoint = { latitude: 31.2123, longitude: 121.4567 }
  page.data[currentPointKey] = currentPoint
  let movedTo = null
  page.mapContext = {
    moveToLocation(point) {
      movedTo = point
    }
  }
  page.restoreVehicleView()
  assert(page.data.mapFollowMode === true, `${relativePath}: locator should re-enable map follow`)
  assert(page.data.mapCenter.latitude === currentPoint.latitude, `${relativePath}: locator should center latitude`)
  assert(page.data.mapCenter.longitude === currentPoint.longitude, `${relativePath}: locator should center longitude`)
  assert(movedTo && movedTo.latitude === currentPoint.latitude, `${relativePath}: locator should move map context`)
}

function verifyMarkup(relativePath, mapId) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
  assert(source.includes(`id="${mapId}"`), `${relativePath}: map id is missing`)
  assert(source.includes('bindregionchange="handleMapRegionChange"'), `${relativePath}: map gesture binding is missing`)
  assert(source.includes('bindtap="restoreVehicleView"'), `${relativePath}: locator control is missing`)
}

function verifyVehicleMarker(relativePath) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
  assert(source.includes("iconPath: '/images/map-car-real-top.png'"), `${relativePath}: realistic vehicle marker is missing`)
  assert(source.includes('rotate:'), `${relativePath}: vehicle heading rotation is missing`)
}

function verifyCircularLocatorMarkup(relativePath, className) {
  const source = fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8')
  assert(source.includes(`<view class="${className}`), `${relativePath}: locator must use a fixed-size view`)
  assert(!source.includes(`<button class="${className}`), `${relativePath}: native button stretches the locator background`)
}

function main() {
  verifyFollowInteraction('pages/trip-progress/index.js', 'currentPoint')
  verifyMarkup('pages/trip-progress/index.wxml', 'driverTripMap')
  verifyVehicleMarker('pages/trip-progress/index.js')
  verifyCircularLocatorMarkup('sunshine-driver-miniapp/pages/trip-progress/index.wxml', 'driver-map-follow')
  verifyCircularLocatorMarkup('sunshine-user-miniapp/pages/trip-progress/index.wxml', 'map-follow-control')
  verifyCircularLocatorMarkup('sunshine-user-miniapp/pages/driver-arrival/index.wxml', 'arrival-map-follow')
  console.log('driver map follow smoke test passed')
}

main()
