const {
  fetchNearbyAddressCandidates,
  getResolvedCurrentLocation,
  hasMapServiceKey,
  normalizeAddressPoint,
  resolvePointFromCoordinate
} = require('../../utils/address')
const {
  decorateAddressList,
  saveHistoryAddress,
  toggleFavoriteAddress
} = require('../../utils/address-book')
const {
  clearSilkyTransitionTimers,
  markSilkyPageReady,
  navigateBackSilky
} = require('../../utils/page')

function isValidCoordinate(latitude, longitude) {
  return Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
}

function isSameCoordinate(left, right, diff = 0.00001) {
  if (!left || !right) return false
  return Math.abs(Number(left.latitude) - Number(right.latitude)) <= diff &&
    Math.abs(Number(left.longitude) - Number(right.longitude)) <= diff
}

function buildPageCopy(typeText) {
  return {
    titleMain: `地图选${typeText}`,
    titleSub: '拖动地图、缩放地图或点击地图后，系统会按中心点实时刷新附近地址',
    tipReady: '当前按地图中心点选点，附近地址列表会按距离实时排序',
    tipFallback: '未配置腾讯地图 Key，当前使用网络反解兜底，建议补充 Key 以获得最佳准确度',
    currentTag: `当前${typeText}`,
    currentTitleFallback: '请在地图上选择地址',
    currentDescFallback: '地图中心点会作为当前选点，并同步刷新附近地址列表',
    myLocationText: '我的位置',
    permissionTitle: '暂未获取定位权限',
    permissionDesc: '你仍然可以拖动地图选点，点击我的位置后可重新触发定位授权。',
    loadingText: '正在刷新附近地址...',
    nearbyTitle: '附近地址',
    nearbySubtitle: '按距离当前地图选点的远近排序',
    emptyTitle: '当前选点附近暂无可展示地址',
    emptyDesc: '可以继续拖动地图，或点击我的位置回到当前位置后重新拉取。',
    confirmText: '确认选点',
    favoriteFilled: '★',
    favoriteOutline: '☆'
  }
}

Page({
  data: {
    type: 'start',
    source: '',
    typeText: '起点',
    statusBarHeight: 20,
    navTop: 32,
    mapHeight: 360,
    panelHeight: 360,
    pageReady: false,
    pageLeaving: false,
    currentLocation: null,
    anchorPoint: null,
    selectedPoint: null,
    latitude: 39.9825,
    longitude: 117.0782,
    zoom: 16,
    selecting: false,
    loadingList: false,
    listAnimating: false,
    mapMoving: false,
    locationPermissionDenied: false,
    mapServiceReady: true,
    markers: [],
    nearbyItems: [],
    favoriteBounceKey: '',
    copy: buildPageCopy('起点')
  },

  async onLoad(options) {
    this.initLayoutMetrics()

    const type = options.type === 'end' ? 'end' : 'start'
    const source = options.source || ''
    const app = getApp()
    const draftPoint = app.globalData.routeDraft && app.globalData.routeDraft[type]

    this.setData({
      type,
      source,
      typeText: type === 'end' ? '终点' : '起点',
      mapServiceReady: hasMapServiceKey(),
      copy: buildPageCopy(type === 'end' ? '终点' : '起点')
    })

    if (draftPoint && isValidCoordinate(draftPoint.latitude, draftPoint.longitude)) {
      this.draftSeedPoint = normalizeAddressPoint(draftPoint, {
        source: draftPoint.source || 'manual'
      })
    }

    markSilkyPageReady(this)

    await this.bootstrapPage()
  },

  onReady() {
    this.mapCtx = wx.createMapContext('pickerMap', this)
  },

  onUnload() {
    clearTimeout(this.enterTimer)
    clearTimeout(this.leaveTimer)
    clearSilkyTransitionTimers(this)
    clearTimeout(this.animateTimer)
    clearTimeout(this.favoriteTimer)
    clearTimeout(this.regionTimer)
  },

  initLayoutMetrics() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const capsule = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const navTop = capsule && capsule.bottom
      ? capsule.bottom + 12
      : (windowInfo.statusBarHeight || 20) + 56
    const windowHeight = windowInfo.windowHeight || 720
    const mapHeight = Math.round(windowHeight * 0.5)

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 20,
      navTop,
      mapHeight,
      panelHeight: windowHeight - mapHeight
    })
  },

  async bootstrapPage() {
    const currentLocation = await this.hydrateLocation(true)
    const seedPoint = currentLocation ||
      (this.data.source === 'search' ? null : this.draftSeedPoint) ||
      this.data.selectedPoint

    if (seedPoint && isValidCoordinate(seedPoint.latitude, seedPoint.longitude)) {
      await this.previewSelection(seedPoint.latitude, seedPoint.longitude, {
        preferredPoint: currentLocation ? null : seedPoint,
        silent: true,
        zoom: currentLocation ? 16 : 17,
        force: true
      })
      return
    }

    this.syncMarkers()
  },

  triggerListAnimation() {
    clearTimeout(this.animateTimer)
    this.setData({ listAnimating: true })
    this.animateTimer = setTimeout(() => {
      this.setData({ listAnimating: false })
    }, 220)
  },

  syncMarkers() {
    const markers = []
    if (this.data.currentLocation && isValidCoordinate(this.data.currentLocation.latitude, this.data.currentLocation.longitude)) {
      markers.push({
        id: 1,
        latitude: this.data.currentLocation.latitude,
        longitude: this.data.currentLocation.longitude,
        width: 28,
        height: 28,
        iconPath: '/images/map-user.png'
      })
    }
    this.setData({ markers })
  },

  async hydrateLocation(silent = false) {
    try {
      const currentLocation = await getResolvedCurrentLocation({ silent })
      this.setData({
        currentLocation,
        locationPermissionDenied: false
      })
      this.syncMarkers()
      return currentLocation
    } catch (error) {
      this.setData({
        locationPermissionDenied: true
      })
      this.syncMarkers()
      return null
    }
  },

  navigateBackWithAnimation(delta) {
    navigateBackSilky(this, {
      delta,
      duration: 160,
      source: 'map-picker'
    })
  },

  handleBack() {
    this.navigateBackWithAnimation(1)
  },

  returnHomeAfterSelection() {
    clearTimeout(this.leaveTimer)
    this.setData({
      pageLeaving: true,
      pageReady: true
    })
    this.leaveTimer = setTimeout(() => {
      wx.switchTab({
        url: '/pages/home/index',
        fail: () => {
          this.setData({
            pageLeaving: false,
            pageReady: true
          })
          wx.showToast({
            title: '返回首页失败，请重试',
            icon: 'none'
          })
        }
      })
    }, 120)
  },

  async getMapCenterLocation() {
    if (!this.mapCtx || !this.mapCtx.getCenterLocation) {
      return {
        latitude: this.data.latitude,
        longitude: this.data.longitude
      }
    }

    return new Promise((resolve) => {
      this.mapCtx.getCenterLocation({
        success: (res) => resolve({
          latitude: Number(res.latitude),
          longitude: Number(res.longitude)
        }),
        fail: () => resolve({
          latitude: this.data.latitude,
          longitude: this.data.longitude
        })
      })
    })
  },

  async syncSelectionWithMapCenter() {
    const center = await this.getMapCenterLocation()
    if (!isValidCoordinate(center.latitude, center.longitude)) {
      return
    }

    const nextPoint = {
      latitude: Number(center.latitude),
      longitude: Number(center.longitude)
    }
    const currentAnchor = this.data.anchorPoint || {}
    if (isSameCoordinate(nextPoint, currentAnchor)) {
      this.setData({ mapMoving: false })
      return
    }

    await this.previewSelection(nextPoint.latitude, nextPoint.longitude, {
      silent: true
    })
  },

  handleRegionChange(e) {
    const detail = e.detail || {}
    if (detail.type === 'begin') {
      this.setData({ mapMoving: true })
      return
    }

    if (detail.type !== 'end') {
      return
    }

    if (detail.causedBy === 'update') {
      this.setData({ mapMoving: false })
      return
    }

    clearTimeout(this.regionTimer)
    this.regionTimer = setTimeout(() => {
      this.syncSelectionWithMapCenter()
    }, detail.causedBy === 'drag' ? 120 : 60)
  },

  handleMapTap(e) {
    const detail = e.detail || {}
    if (!isValidCoordinate(detail.latitude, detail.longitude)) return
    this.previewSelection(detail.latitude, detail.longitude, {
      silent: true
    })
  },

  handleMapLongPress(e) {
    const detail = e.detail || {}
    if (!isValidCoordinate(detail.latitude, detail.longitude)) return
    this.previewSelection(detail.latitude, detail.longitude, {
      silent: true
    })
  },

  async previewSelection(latitude, longitude, options = {}) {
    const nextLatitude = Number(latitude)
    const nextLongitude = Number(longitude)
    if (!isValidCoordinate(nextLatitude, nextLongitude)) {
      return
    }
    const requestKey = `${nextLatitude.toFixed(6)},${nextLongitude.toFixed(6)}`
    if (!options.force && this.lastPreviewKey === requestKey && !options.preferredPoint && !options.preferredAddressKey) {
      return
    }

    const requestId = (this.previewRequestId || 0) + 1
    const centerPoint = {
      latitude: nextLatitude,
      longitude: nextLongitude
    }
    this.previewRequestId = requestId
    this.lastPreviewKey = requestKey
    this.triggerListAnimation()

    this.setData({
      selecting: true,
      loadingList: true,
      mapMoving: false,
      latitude: nextLatitude,
      longitude: nextLongitude,
      zoom: Number(options.zoom || this.data.zoom || 16)
    })

    try {
      const anchorBase = await resolvePointFromCoordinate(nextLatitude, nextLongitude, centerPoint)
      const anchorPoint = decorateAddressList([anchorBase], centerPoint)[0]
      const response = await fetchNearbyAddressCandidates(centerPoint, {
        pageIndex: 1,
        pageSize: 18,
        radius: 1200,
        anchorPoint
      })
      let nearbyItems = decorateAddressList(response.list || [], centerPoint)
        .sort((left, right) => Number(left.distanceKm || 0) - Number(right.distanceKm || 0))

      if (!nearbyItems.length) {
        nearbyItems = [anchorPoint]
      } else if (!nearbyItems.find((item) => item.addressKey === anchorPoint.addressKey)) {
        nearbyItems = [anchorPoint].concat(nearbyItems)
      }

      let selectedPoint = anchorPoint
      if (options.preferredPoint) {
        const preferred = decorateAddressList([options.preferredPoint], centerPoint)[0]
        const matchedPreferred = nearbyItems.find((item) => item.addressKey === preferred.addressKey)
        selectedPoint = matchedPreferred || preferred
      }
      if (options.preferredAddressKey) {
        const matched = nearbyItems.find((item) => item.addressKey === options.preferredAddressKey)
        if (matched) {
          selectedPoint = matched
        }
      }

      if (requestId !== this.previewRequestId) {
        return
      }

      this.setData({
        anchorPoint,
        selectedPoint,
        nearbyItems,
        latitude: nextLatitude,
        longitude: nextLongitude
      })
      this.syncMarkers()
    } catch (error) {
      if (requestId !== this.previewRequestId) {
        return
      }

      if (!options.silent) {
        wx.showToast({
          title: '地图选点解析失败，请重试',
          icon: 'none'
        })
      }
    } finally {
      if (requestId !== this.previewRequestId) {
        return
      }

      this.setData({
        selecting: false,
        loadingList: false
      })
    }
  },

  async chooseNearbyAddress(e) {
    const item = e.currentTarget.dataset.item
    if (!item || !isValidCoordinate(item.latitude, item.longitude)) return

    await this.previewSelection(item.latitude, item.longitude, {
      preferredAddressKey: item.addressKey,
      preferredPoint: item,
      silent: true,
      zoom: 17
    })
  },

  async useMyLocation() {
    try {
      const currentLocation = await getResolvedCurrentLocation()
      this.setData({
        currentLocation,
        locationPermissionDenied: false
      })
      this.syncMarkers()
      await this.previewSelection(currentLocation.latitude, currentLocation.longitude, {
        preferredPoint: currentLocation,
        silent: true,
        zoom: 16
      })
    } catch (error) {
      this.setData({ locationPermissionDenied: true })
      wx.showToast({
        title: '未能获取当前位置，请检查定位权限',
        icon: 'none'
      })
    }
  },

  handleFavoriteTap(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return

    toggleFavoriteAddress(item)
    clearTimeout(this.favoriteTimer)
    this.setData({
      favoriteBounceKey: item.addressKey
    })
    this.favoriteTimer = setTimeout(() => {
      this.setData({ favoriteBounceKey: '' })
    }, 260)

    const referencePoint = this.data.anchorPoint || this.data.selectedPoint || this.data.currentLocation
    this.setData({
      nearbyItems: decorateAddressList(this.data.nearbyItems || [], referencePoint),
      selectedPoint: this.data.selectedPoint
        ? decorateAddressList([this.data.selectedPoint], referencePoint)[0]
        : null
    })
  },

  confirmSelection() {
    const point = this.data.selectedPoint || this.data.anchorPoint
    if (!point) {
      wx.showToast({
        title: '请先在地图上选择地址',
        icon: 'none'
      })
      return
    }

    const app = getApp()
    const normalized = normalizeAddressPoint(point, {
      source: 'map'
    })
    const draft = {
      ...app.globalData.routeDraft,
      [this.data.type]: normalized
    }

    saveHistoryAddress(normalized)
    app.updateDraft(draft)
    if (this.data.source === 'search') {
      this.returnHomeAfterSelection()
      return
    }

    this.navigateBackWithAnimation(1)
  }
})
