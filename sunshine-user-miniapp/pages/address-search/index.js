const {
  getResolvedCurrentLocation,
  normalizeAddressPoint,
  searchAddressCandidates
} = require('../../utils/address')
const {
  clearHistoryAddresses,
  decorateAddressList,
  deleteHistoryAddress,
  getFavoriteAddresses,
  getHistoryAddresses,
  saveHistoryAddress,
  toggleFavoriteAddress
} = require('../../utils/address-book')
const {
  clearSilkyTransitionTimers,
  markSilkyPageReady,
  navigateBackSilky
} = require('../../utils/page')

function buildEmptyState(mode, keyword) {
  if (mode === 'search') {
    return {
      title: '暂无匹配的地址，请换个关键字试试',
      desc: keyword
        ? `已为你搜索“${keyword}”相关地址，可尝试更换关键词或使用地图选点。`
        : '请输入地址关键字进行搜索。'
    }
  }

  return {
    title: '暂无历史搜索记录',
    desc: '选中过的起点或终点会自动保存在这里，下次打开可直接复用。'
  }
}

function buildCandidateState({ keyword, searchItems = [], historyItems = [], favoriteItems = [], isInputFocused, loading }) {
  const trimmedKeyword = `${keyword || ''}`.trim()
  const added = {}
  const candidateItems = []

  const appendUnique = (list = []) => {
    list.forEach((item) => {
      if (!item || !item.addressKey || added[item.addressKey]) return
      added[item.addressKey] = true
      candidateItems.push(item)
    })
  }

  if (trimmedKeyword) {
    appendUnique(searchItems)
    return {
      candidateTitle: '搜索候选',
      candidateItems: candidateItems.slice(0, 6),
      candidateEmptyText: loading ? '正在加载候选地址...' : '没有匹配地址，试试换个关键词',
      showSuggestionPanel: Boolean(isInputFocused)
    }
  }

  appendUnique(favoriteItems)
  appendUnique(historyItems)

  return {
    candidateTitle: '常用与最近',
    candidateItems: candidateItems.slice(0, 6),
    candidateEmptyText: '输入关键词后，这里会显示候选地址',
    showSuggestionPanel: Boolean(isInputFocused)
  }
}

function buildSearchSuggestionState({ keyword, searchItems = [], isInputFocused, loading }) {
  const trimmedKeyword = `${keyword || ''}`.trim()
  const candidateItems = Array.isArray(searchItems) ? searchItems.slice(0, 6) : []

  if (trimmedKeyword) {
    return {
      candidateTitle: '搜索候选',
      candidateItems,
      candidateEmptyText: loading ? '正在加载候选地址...' : '没有匹配地址，试试换个关键词',
      showSuggestionPanel: Boolean(isInputFocused)
    }
  }

  return {
    candidateTitle: '搜索候选',
    candidateItems: [],
    candidateEmptyText: '请输入任意地点，例如北京西站、杭州西湖、天安门',
    showSuggestionPanel: Boolean(isInputFocused)
  }
}

Page({
  data: {
    type: 'start',
    placeholder: '请输入起点',
    keyword: '',
    isInputFocused: false,
    statusBarHeight: 20,
    navTop: 32,
    pageReady: false,
    pageLeaving: false,
    currentLocation: null,
    historyItems: [],
    searchItems: [],
    favoriteItems: [],
    listItems: [],
    displayMode: 'history',
    showFavoritePanel: false,
    loading: false,
    refreshing: false,
    empty: false,
    loadError: false,
    emptyTitle: '暂无历史搜索记录',
    emptyDesc: '选中过的起点或终点会自动保存在这里，下次打开可直接复用。',
    listAnimating: false,
    permissionDenied: false,
    favoriteBounceKey: '',
    swipeKey: '',
    deleteWidthPx: 84,
    candidateTitle: '常用与最近',
    candidateItems: [],
    candidateEmptyText: '输入关键词后，这里会显示候选地址',
    showSuggestionPanel: false
  },

  async onLoad(options) {
    this.initLayoutMetrics()

    const type = options.type === 'end' ? 'end' : 'start'
    this.setData({
      type,
      placeholder: type === 'end' ? '请输入终点' : '请输入起点'
    })

    markSilkyPageReady(this)

    await this.bootstrapPage()
  },

  onUnload() {
    clearTimeout(this.enterTimer)
    clearTimeout(this.leaveTimer)
    clearSilkyTransitionTimers(this)
    clearTimeout(this.animateTimer)
    clearTimeout(this.favoriteTimer)
    clearTimeout(this.blurTimer)
    clearTimeout(this.searchDebounceTimer)
  },

  initLayoutMetrics() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const capsule = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const navTop = capsule && capsule.bottom
      ? capsule.bottom + 12
      : (windowInfo.statusBarHeight || 20) + 56

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 20,
      navTop,
      deleteWidthPx: Math.round(((windowInfo.windowWidth || 375) * 168) / 750)
    })
  },

  async bootstrapPage() {
    await this.hydrateCurrentLocation(true)
    this.refreshStoredCollections({ forceVisibleRefresh: true })
  },

  getDraftFallbackPoint() {
    const app = getApp()
    const routeDraft = app.globalData.routeDraft || {}
    const fallback = normalizeAddressPoint(routeDraft.start || routeDraft.end || {})
    return fallback.latitude ? fallback : null
  },

  async hydrateCurrentLocation(silent = false) {
    try {
      const currentLocation = await getResolvedCurrentLocation({ silent })
      this.setData({
        currentLocation,
        permissionDenied: false
      })
      return currentLocation
    } catch (error) {
      const fallback = this.getDraftFallbackPoint()
      this.setData({
        currentLocation: fallback,
        permissionDenied: true
      })
      return fallback
    }
  },

  triggerListAnimation() {
    clearTimeout(this.animateTimer)
    this.setData({ listAnimating: true })
    this.animateTimer = setTimeout(() => {
      this.setData({ listAnimating: false })
    }, 220)
  },

  prepareList(list = [], mode = 'history') {
    const stateMap = (this.data.listItems || []).reduce((result, item) => {
      result[item.addressKey] = item
      return result
    }, {})

    return list.map((item) => {
      const previous = stateMap[item.addressKey] || {}
      return {
        ...item,
        canSwipe: mode === 'history',
        swipeX: mode === 'history' ? Number(previous.swipeX || 0) : 0,
        deleting: Boolean(previous.deleting)
      }
    })
  },

  setVisibleList(list = [], mode = 'history') {
    const preparedList = this.prepareList(list, mode)
    const emptyState = buildEmptyState(mode, `${this.data.keyword || ''}`.trim())

    this.setData({
      listItems: preparedList,
      displayMode: mode,
      empty: !preparedList.length,
      emptyTitle: emptyState.title,
      emptyDesc: emptyState.desc,
      loadError: false,
      swipeKey: ''
    }, () => {
      this.refreshCandidatePanel()
    })
  },

  refreshCandidatePanel(overrides = {}) {
    this.setData(buildSearchSuggestionState({
      keyword: overrides.keyword !== undefined ? overrides.keyword : this.data.keyword,
      searchItems: overrides.searchItems || this.data.searchItems,
      isInputFocused: overrides.isInputFocused !== undefined ? overrides.isInputFocused : this.data.isInputFocused,
      loading: overrides.loading !== undefined ? overrides.loading : this.data.loading
    }))
  },

  refreshStoredCollections({ forceVisibleRefresh = false } = {}) {
    const currentLocation = this.data.currentLocation
    const historyItems = getHistoryAddresses(currentLocation)
    const favoriteItems = getFavoriteAddresses(currentLocation)
    const searchItems = decorateAddressList(this.data.searchItems || [], currentLocation)
    const visibleMode = `${this.data.keyword || ''}`.trim() ? 'search' : 'history'

    this.setData({
      historyItems,
      favoriteItems,
      searchItems,
      showFavoritePanel: favoriteItems.length ? this.data.showFavoritePanel : false
    }, () => {
      this.refreshCandidatePanel({
        historyItems,
        favoriteItems,
        searchItems
      })
    })

    if (forceVisibleRefresh || visibleMode === 'history') {
      this.setVisibleList(visibleMode === 'search' ? searchItems : historyItems, visibleMode)
    }
  },

  async executeSearch(keywordOverride) {
    const keyword = `${keywordOverride !== undefined ? keywordOverride : this.data.keyword || ''}`.trim()
    const requestId = (this.searchRequestId || 0) + 1
    this.searchRequestId = requestId

    if (!keyword) {
      this.setData({
        searchItems: [],
        loading: false,
        loadError: false
      }, () => {
        this.refreshCandidatePanel({
          keyword: '',
          searchItems: [],
          loading: false
        })
      })
      this.refreshStoredCollections({ forceVisibleRefresh: true })
      return
    }

    this.triggerListAnimation()
    this.setData({
      displayMode: 'search',
      loading: true,
      loadError: false,
      empty: false,
      showFavoritePanel: false
    }, () => {
      this.refreshCandidatePanel({
        keyword,
        loading: true
      })
    })

    try {
      const response = await searchAddressCandidates(keyword, this.data.currentLocation, {
        pageIndex: 1,
        pageSize: 20
      })

      if (requestId !== this.searchRequestId || `${this.data.keyword || ''}`.trim() !== keyword) {
        return
      }

      const searchItems = decorateAddressList(response.list || [], this.data.currentLocation)
      this.setData({ searchItems }, () => {
        this.refreshCandidatePanel({
          keyword,
          searchItems,
          loading: false
        })
      })
      this.setVisibleList(searchItems, 'search')
    } catch (error) {
      if (requestId !== this.searchRequestId) {
        return
      }

      this.setData({
        loadError: true,
        empty: false,
        listItems: [],
        displayMode: 'search'
      })
      wx.showToast({
        title: '地址加载失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      if (requestId !== this.searchRequestId) {
        return
      }

      this.setData({
        loading: false,
        refreshing: false
      }, () => {
        this.refreshCandidatePanel({
          loading: false
        })
      })
    }
  },

  handleInputFocus() {
    clearTimeout(this.blurTimer)
    this.setData({
      isInputFocused: true,
      showFavoritePanel: false
    }, () => {
      this.refreshCandidatePanel({
        isInputFocused: true
      })
    })
  },

  handleInputBlur() {
    clearTimeout(this.blurTimer)
    this.blurTimer = setTimeout(() => {
      this.setData({
        isInputFocused: false,
        showSuggestionPanel: false
      })
    }, 120)
  },

  handleInputConfirm() {
    clearTimeout(this.searchDebounceTimer)
    this.executeSearch()
  },

  updateKeyword(e) {
    const keyword = e.detail.value || ''
    const trimmedKeyword = `${keyword}`.trim()

    this.setData({
      keyword,
      showFavoritePanel: false
    }, () => {
      this.refreshCandidatePanel({
        keyword
      })
    })

    if (!trimmedKeyword) {
      clearTimeout(this.searchDebounceTimer)
      this.executeSearch('')
      return
    }

    clearTimeout(this.searchDebounceTimer)
    this.searchDebounceTimer = setTimeout(() => {
      this.executeSearch(trimmedKeyword)
    }, 260)
  },

  navigateBackWithAnimation() {
    navigateBackSilky(this, {
      delta: 1,
      duration: 160,
      beforeLeave: () => {
        clearTimeout(this.blurTimer)
        this.setData({
          isInputFocused: false,
          showSuggestionPanel: false
        })
        wx.hideKeyboard({
          complete: () => {}
        })
      }
    })
  },

  handleBack() {
    this.navigateBackWithAnimation()
  },

  commitAddress(point) {
    clearTimeout(this.blurTimer)
    const normalized = normalizeAddressPoint(point, {
      source: point.source || 'manual'
    })
    const app = getApp()
    const draft = {
      ...app.globalData.routeDraft,
      [this.data.type]: normalized
    }

    saveHistoryAddress(normalized)
    app.updateDraft(draft)
    this.refreshStoredCollections()
    this.navigateBackWithAnimation()
  },

  chooseAddress(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    this.commitAddress(item)
  },

  async chooseMyLocation() {
    clearTimeout(this.blurTimer)
    this.setData({
      isInputFocused: false,
      showSuggestionPanel: false
    })
    wx.hideKeyboard({
      complete: () => {}
    })
    try {
      const currentLocation = await getResolvedCurrentLocation()
      this.commitAddress(currentLocation)
    } catch (error) {
      wx.showToast({
        title: '未能获取当前位置，请检查定位权限',
        icon: 'none'
      })
    }
  },

  toggleFavoritePanel() {
    const favoriteItems = getFavoriteAddresses(this.data.currentLocation)
    if (!favoriteItems.length) {
      wx.showToast({
        title: '收藏夹还是空的',
        icon: 'none'
      })
      return
    }

    clearTimeout(this.blurTimer)
    this.setData({
      isInputFocused: false,
      showSuggestionPanel: false
    })
    wx.hideKeyboard({
      complete: () => {}
    })
    this.setData({
      favoriteItems,
      showFavoritePanel: !this.data.showFavoritePanel
    })
  },

  openMapPicker() {
    clearTimeout(this.blurTimer)
    this.setData({
      isInputFocused: false,
      showSuggestionPanel: false
    })
    wx.hideKeyboard({
      complete: () => {}
    })
    wx.navigateTo({
      url: `/pages/map-picker/index?type=${this.data.type}&source=search`
    })
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

    this.refreshStoredCollections({ forceVisibleRefresh: true })
  },

  handleRowTouchStart(e) {
    if (this.data.displayMode !== 'history') return

    const addressKey = e.currentTarget.dataset.key
    if (!addressKey) return

    this.touchingKey = addressKey
    this.touchStartX = Number(e.changedTouches[0].clientX || 0)
    this.touchStartSwipeX = Number(e.currentTarget.dataset.swipex || 0)

    const listItems = (this.data.listItems || []).map((item) => ({
      ...item,
      swipeX: item.addressKey === addressKey ? item.swipeX : 0
    }))

    this.setData({
      listItems,
      swipeKey: addressKey
    })
  },

  handleRowTouchMove(e) {
    if (this.data.displayMode !== 'history' || !this.touchingKey) return

    const currentX = Number(e.changedTouches[0].clientX || 0)
    const deltaX = currentX - this.touchStartX
    const deleteWidthPx = Number(this.data.deleteWidthPx || 84)
    let nextSwipeX = this.touchStartSwipeX + deltaX

    if (nextSwipeX > 0) {
      nextSwipeX *= 0.18
    }

    if (nextSwipeX < -deleteWidthPx) {
      nextSwipeX = -deleteWidthPx - ((Math.abs(nextSwipeX) - deleteWidthPx) * 0.28)
    }

    const listItems = (this.data.listItems || []).map((item) => {
      if (item.addressKey !== this.touchingKey) {
        return {
          ...item,
          swipeX: 0
        }
      }

      return {
        ...item,
        swipeX: Math.max(nextSwipeX, -deleteWidthPx - 18)
      }
    })

    this.setData({ listItems })
  },

  handleRowTouchEnd(e) {
    if (this.data.displayMode !== 'history' || !this.touchingKey) return

    const addressKey = e.currentTarget.dataset.key
    const currentItem = (this.data.listItems || []).find((item) => item.addressKey === addressKey)
    const deleteWidthPx = Number(this.data.deleteWidthPx || 84)
    const shouldOpen = currentItem && Math.abs(Number(currentItem.swipeX || 0)) > (deleteWidthPx * 0.45)

    const listItems = (this.data.listItems || []).map((item) => ({
      ...item,
      swipeX: item.addressKey === addressKey && shouldOpen ? -deleteWidthPx : 0
    }))

    this.touchingKey = ''
    this.touchStartX = 0
    this.touchStartSwipeX = 0

    this.setData({
      listItems,
      swipeKey: shouldOpen ? addressKey : ''
    })
  },

  deleteHistoryItem(e) {
    const addressKey = e.currentTarget.dataset.key
    if (!addressKey) return

    const deleteWidthPx = Number(this.data.deleteWidthPx || 84)
    const listItems = (this.data.listItems || []).map((item) => {
      if (item.addressKey !== addressKey) {
        return item
      }

      return {
        ...item,
        deleting: true,
        swipeX: -deleteWidthPx
      }
    })

    this.setData({ listItems })

    setTimeout(() => {
      deleteHistoryAddress(addressKey)
      this.refreshStoredCollections({ forceVisibleRefresh: true })
    }, 180)
  },

  clearHistory() {
    if (!this.data.historyItems.length) return

    wx.showModal({
      title: '清空历史记录',
      content: '清空后无法恢复，确认删除全部历史搜索记录吗？',
      confirmColor: '#ff7a00',
      success: (res) => {
        if (!res.confirm) return
        clearHistoryAddresses()
        this.refreshStoredCollections({ forceVisibleRefresh: true })
      }
    })
  },

  async onRefresh() {
    this.setData({ refreshing: true })
    await this.hydrateCurrentLocation(true)

    if (`${this.data.keyword || ''}`.trim()) {
      await this.executeSearch()
      return
    }

    this.refreshStoredCollections({ forceVisibleRefresh: true })
    this.setData({ refreshing: false })
  },

  async retryLoad() {
    await this.hydrateCurrentLocation(true)
    await this.executeSearch()
  }
})
