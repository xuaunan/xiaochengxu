const { activateMembership, fetchCouponCenter, fetchMembership, fetchMyCoupons, receiveCoupon } = require('../../utils/api')
const { mergeCoupons } = require('../../utils/user-store')
const { runExclusive } = require('../../utils/page')
const { formatDate } = require('../../utils/format')
const { COUPON_STATUS, COUPON_TYPE, getCouponScopeLabel } = require('../../utils/constants')

const MY_COUPON_PREVIEW_SIZE = 2
const CENTER_COUPON_PREVIEW_SIZE = 3

const TAB_META = {
  unused: {
    label: '可使用',
    moreText: '可用券'
  },
  used: {
    label: '已使用',
    moreText: '已用券'
  },
  expired: {
    label: '已过期',
    moreText: '过期券'
  }
}

function formatNumber(value, fallback = 0) {
  const number = Number(value || fallback)
  if (!Number.isFinite(number)) return `${fallback}`
  return Number.isInteger(number) ? `${number}` : number.toFixed(2).replace(/\.?0+$/, '')
}

function buildFaceValue(coupon = {}) {
  const isDiscount = coupon.discount || coupon.couponType === COUPON_TYPE.DISCOUNT
  if (isDiscount) {
    const rate = Number(coupon.amount || coupon.discountRate || 0.8)
    return `${formatNumber(rate * 10, 8)}折`
  }
  return `${formatNumber(coupon.amount || coupon.discountAmount, 0)}元`
}

function splitFaceValue(text) {
  const value = `${text || ''}`.trim()
  const match = value.match(/^([0-9]+(?:\.[0-9]+)?)(.*)$/)
  if (!match) {
    return {
      faceValueMain: value || '--',
      faceValueUnit: ''
    }
  }
  return {
    faceValueMain: match[1],
    faceValueUnit: match[2] || ''
  }
}

function buildRuleText(minAmount, validDate) {
  return `满 ${formatNumber(minAmount, 0)} 可用 · ${validDate || '--'} 前有效`
}

function normalizeCouponStatus(status) {
  return `${status || COUPON_STATUS.UNUSED}`.toLowerCase()
}

function decorateMyCoupon(item = {}) {
  const status = normalizeCouponStatus(item.status || item.rawStatus)
  const statusTextMap = {
    unused: '可用',
    used: '已使用',
    expired: '已过期'
  }
  const faceValueText = item.faceValueText || buildFaceValue(item)
  const faceValue = splitFaceValue(faceValueText)
  const isUsable = status === 'unused'
  return {
    ...item,
    ...faceValue,
    faceValueText,
    theme: 'orange',
    scopeText: item.scope || getCouponScopeLabel(item.scopeCode),
    title: item.name,
    ruleText: item.ruleText || buildRuleText(item.minAmount, item.validDate),
    metaText: item.metaText || `券码 ${item.code || '--'}`,
    status,
    statusText: statusTextMap[status] || '可用',
    statusClass: isUsable ? 'coupon-status-active' : '',
    actionText: isUsable ? '立即使用' : '',
    actionDisabled: !isUsable,
    cardDisabled: !isUsable
  }
}

function decorateCenterCoupon(item = {}) {
  const remainCount = Number(item.remainCount === undefined ? 1 : item.remainCount)
  const faceValueText = buildFaceValue(item)
  return {
    ...item,
    ...splitFaceValue(faceValueText),
    faceValueText,
    theme: 'purple',
    scopeText: getCouponScopeLabel(item.serviceScope),
    title: item.couponName || '优惠券',
    ruleText: buildRuleText(item.thresholdAmount, formatDate(item.validEndTime)),
    metaText: `库存 ${formatNumber(remainCount, 0)} · ${item.ruleDesc || '领取后自动加入券包'}`,
    actionText: remainCount > 0 ? '领取' : '已抢光',
    actionDisabled: remainCount <= 0,
    cardDisabled: remainCount <= 0
  }
}

function countByStatus(list = []) {
  return list.reduce((result, item) => {
    const status = normalizeCouponStatus(item.status || item.rawStatus)
    if (status === 'used') result.used += 1
    else if (status === 'expired') result.expired += 1
    else result.unused += 1
    return result
  }, {
    unused: 0,
    used: 0,
    expired: 0
  })
}

function buildTabs(list = []) {
  const counts = countByStatus(list)
  return ['unused', 'used', 'expired'].map((key) => ({
    key,
    label: `${TAB_META[key].label} (${counts[key]})`
  }))
}

function getCouponKey(coupon = {}) {
  return `${coupon.userCouponId || coupon.id || coupon.code || ''}`
}

function mergeUniqueCoupons(primary = [], secondary = []) {
  const result = []
  const seen = new Set()
  ;[primary, secondary].forEach((list) => {
    ;(Array.isArray(list) ? list : []).forEach((coupon) => {
      const key = getCouponKey(coupon)
      if (!key || seen.has(key)) return
      seen.add(key)
      result.push(coupon)
    })
  })
  return result
}

function buildMembershipView(membership = {}) {
  if (membership.active) {
    return {
      memberTitle: '会员已开通，专属券包已到账',
      memberDesc: `有效期至 ${membership.expireDate || '--'} · 每周3张不同优惠券`,
      memberButtonText: '查看'
    }
  }
  return {
    memberTitle: '开通会员尊享更多优惠',
    memberDesc: '每周赠送3张不同优惠券 · 优先客服',
    memberButtonText: '去开通'
  }
}

function syncMembershipToStore(membership = {}) {
  const app = getApp()
  const store = app.globalData.userStore || {}
  store.membership = {
    ...(store.membership || {}),
    active: Boolean(membership.active),
    status: membership.memberStatus || (membership.active ? 'ACTIVE' : 'NONE'),
    level: membership.memberLevel || (membership.active ? '阳光会员' : '普通用户'),
    openedAt: membership.memberOpenedAt || '',
    expireAt: membership.memberExpireAt || '',
    expireDate: membership.expireDate || `${membership.memberExpireAt || ''}`.slice(0, 10),
    packageWeek: membership.memberLastCouponWeek || '',
    weeklyCouponTotal: membership.weeklyCouponTotal || 0,
    couponRuleText: membership.couponRuleText || '每周自动赠送 3 张不同优惠券'
  }
  store.profile = {
    ...(store.profile || {}),
    memberStatus: store.membership.status,
    memberLevel: store.membership.level,
    memberExpireAt: store.membership.expireAt
  }
  app.globalData.userStore = store
  app.saveUserStore()
  return store.membership
}

Page({
  data: {
    active: 'unused',
    tabs: buildTabs(),
    list: [],
    visibleList: [],
    couponListExpanded: false,
    showCouponListToggle: false,
    couponListToggleText: '',
    currentTabCount: 0,
    currentTabMoreText: TAB_META.unused.moreText,
    centerList: [],
    visibleCenterList: [],
    centerListExpanded: false,
    showCenterToggle: false,
    centerToggleText: '',
    allCoupons: [],
    usableCount: 0,
    membership: {},
    ...buildMembershipView()
  },

  async onShow() {
    this.setData({
      couponListExpanded: false,
      centerListExpanded: false
    })
    this.renderCachedCoupons()
    await this.refreshList()
  },

  chooseTab(e) {
    this.setData({
      active: e.currentTarget.dataset.key,
      couponListExpanded: false
    })
    this.applyFilter()
  },

  async refreshList() {
    return runExclusive(this, '__refreshCouponPromise', async () => {
      const membershipResponse = await fetchMembership()
      syncMembershipToStore(membershipResponse.data || {})
      const [mineResponse, centerResponse] = await Promise.all([
        fetchMyCoupons(),
        fetchCouponCenter()
      ])
      const app = getApp()
      const store = app.globalData.userStore || {}
      const remoteCoupons = mergeCoupons(mineResponse.data || [], centerResponse.data || [])
      const list = mergeUniqueCoupons(remoteCoupons, [])
      store.memberCoupons = []
      store.coupons = list
      store.couponCenter = centerResponse.data || []
      app.globalData.userStore = store
      app.saveUserStore()
      this.setData({
        centerList: (centerResponse.data || []).map(decorateCenterCoupon),
        allCoupons: list,
        usableCount: countByStatus(list).unused
      })
      this.renderMembership()
      this.applyFilter()
      this.applyCenterVisible()
    })
  },

  renderCachedCoupons() {
    const store = getApp().globalData.userStore || {}
    const allCoupons = mergeUniqueCoupons(store.coupons || [], [])
    this.setData({
      centerList: (store.couponCenter || []).map(decorateCenterCoupon),
      allCoupons,
      usableCount: countByStatus(allCoupons).unused
    })
    this.renderMembership()
    this.applyFilter()
    this.applyCenterVisible()
  },

  renderMembership() {
    const membership = (getApp().globalData.userStore || {}).membership || {}
    this.setData({
      membership,
      ...buildMembershipView(membership)
    })
  },

  applyFilter() {
    const list = (this.data.allCoupons || [])
      .filter((item) => normalizeCouponStatus(item.status || item.rawStatus) === this.data.active)
      .map(decorateMyCoupon)
    const visibleList = this.data.couponListExpanded ? list : list.slice(0, MY_COUPON_PREVIEW_SIZE)
    const restCount = Math.max(list.length - visibleList.length, 0)
    this.setData({
      tabs: buildTabs(this.data.allCoupons),
      list,
      visibleList,
      currentTabCount: list.length,
      currentTabMoreText: (TAB_META[this.data.active] || TAB_META.unused).moreText,
      showCouponListToggle: list.length > MY_COUPON_PREVIEW_SIZE,
      couponListToggleText: this.data.couponListExpanded
        ? '收起'
        : `展开更多 (${restCount})`
    })
  },

  applyCenterVisible() {
    const centerList = this.data.centerList || []
    const visibleCenterList = this.data.centerListExpanded
      ? centerList
      : centerList.slice(0, CENTER_COUPON_PREVIEW_SIZE)
    const restCount = Math.max(centerList.length - visibleCenterList.length, 0)
    this.setData({
      visibleCenterList,
      showCenterToggle: centerList.length > CENTER_COUPON_PREVIEW_SIZE,
      centerToggleText: this.data.centerListExpanded
        ? '收起'
        : `展开更多 (${restCount})`
    })
  },

  toggleCouponList() {
    this.setData({
      couponListExpanded: !this.data.couponListExpanded
    })
    this.applyFilter()
  },

  toggleCenterList() {
    this.setData({
      centerListExpanded: !this.data.centerListExpanded
    })
    this.applyCenterVisible()
  },

  jumpToHome() {
    wx.switchTab({
      url: '/pages/home/index'
    })
  },

  handleSelect(e) {
    const coupon = e.detail && e.detail.item
    if (!coupon || normalizeCouponStatus(coupon.status || coupon.rawStatus) !== 'unused') return
    this.handleUseCoupon(e)
  },

  handleUseCoupon(e) {
    const coupon = e.detail && e.detail.item
    if (!coupon || coupon.actionDisabled || coupon.cardDisabled) return
    const app = getApp()
    app.globalData.userStore.pendingCouponUse = {
      userCouponId: coupon.userCouponId || coupon.id,
      couponName: coupon.name || coupon.title,
      savedAt: Date.now()
    }
    app.updateDraft({
      ...(app.globalData.routeDraft || {}),
      selectedCouponId: coupon.userCouponId || coupon.id
    })
    app.saveUserStore()
    wx.showToast({
      title: '已带上优惠券',
      icon: 'success'
    })
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/home/index'
      })
    }, 260)
  },

  async claimCoupon(e) {
    const coupon = e.detail && e.detail.item
    const couponId = (e.detail && e.detail.id) || (e.currentTarget && e.currentTarget.dataset.id)
    if (coupon && coupon.actionDisabled) return
    await receiveCoupon(couponId)
    wx.showToast({
      title: '优惠券领取成功',
      icon: 'success'
    })
    await this.refreshList()
  },

  openMembership() {
    const store = getApp().globalData.userStore || {}
    const membership = store.membership || {}
    if (membership.active) {
      wx.showModal({
        title: '会员权益',
        content: `每周 3 张不同优惠券会自动同步到我的券包，有效期至 ${store.membership.expireDate || '--'}。`,
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }

    wx.showModal({
      title: '开通阳光会员',
      content: '开通后立即发放本周 3 张不同会员券，并享受优先客服。',
      cancelText: '再想想',
      confirmText: '去开通',
      success: async (res) => {
        if (!res.confirm) return
        await this.activateMembershipRemote()
      }
    })
  },

  async activateMembershipRemote() {
    const response = await activateMembership()
    syncMembershipToStore(response.data || {})
    await this.refreshList()
    wx.showToast({
      title: '会员已开通',
      icon: 'success'
    })
  }
})
