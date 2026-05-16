const { fetchCouponCenter, fetchMyCoupons, receiveCoupon } = require('../../utils/api')
const { mergeCoupons } = require('../../utils/user-store')
const { runExclusive } = require('../../utils/page')
const { formatDate } = require('../../utils/format')
const { COUPON_TYPE, getCouponScopeLabel } = require('../../utils/constants')

const MY_COUPON_PREVIEW_SIZE = 2
const CENTER_COUPON_PREVIEW_SIZE = 3

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

function buildRuleText(minAmount, validDate) {
  return `满 ${formatNumber(minAmount, 0)} 可用 · ${validDate || '--'} 前有效`
}

function decorateMyCoupon(item = {}) {
  const statusTextMap = {
    unused: '可用',
    used: '已用',
    expired: '过期'
  }
  return {
    ...item,
    faceValueText: buildFaceValue(item),
    scopeText: item.scope || getCouponScopeLabel(item.scopeCode),
    title: item.name,
    ruleText: buildRuleText(item.minAmount, item.validDate),
    metaText: `券码 ${item.code || '--'}`,
    statusText: statusTextMap[item.status] || '可用',
    statusClass: item.status === 'unused' ? 'coupon-status-active' : '',
    cardDisabled: item.status !== 'unused'
  }
}

function decorateCenterCoupon(item = {}) {
  const remainCount = Number(item.remainCount || 0)
  return {
    ...item,
    faceValueText: buildFaceValue(item),
    scopeText: getCouponScopeLabel(item.serviceScope),
    title: item.couponName || '优惠券',
    ruleText: buildRuleText(item.thresholdAmount, formatDate(item.validEndTime)),
    metaText: `库存 ${formatNumber(remainCount, 0)} · ${item.ruleDesc || '领取后自动同步到券包'}`,
    actionText: remainCount > 0 ? '领取' : '已抢光',
    actionDisabled: remainCount <= 0,
    cardDisabled: remainCount <= 0
  }
}

Page({
  data: {
    active: 'unused',
    tabs: [
      { key: 'unused', label: '\u5f85\u4f7f\u7528' },
      { key: 'used', label: '\u5df2\u4f7f\u7528' },
      { key: 'expired', label: '\u5df2\u8fc7\u671f' }
    ],
    list: [],
    visibleList: [],
    couponListExpanded: false,
    showCouponListToggle: false,
    couponListToggleText: '',
    centerList: [],
    visibleCenterList: [],
    centerListExpanded: false,
    showCenterToggle: false,
    centerToggleText: '',
    allCoupons: []
  },

  async onShow() {
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
      const [mineResponse, centerResponse] = await Promise.all([
        fetchMyCoupons(),
        fetchCouponCenter()
      ])
      const list = mergeCoupons(mineResponse.data || [], centerResponse.data || [])
      getApp().globalData.userStore.coupons = list
      getApp().globalData.userStore.couponCenter = centerResponse.data || []
      getApp().saveUserStore()
      this.setData({
        centerList: (centerResponse.data || []).map(decorateCenterCoupon),
        allCoupons: list
      })
      this.applyFilter()
      this.applyCenterVisible()
    })
  },

  renderCachedCoupons() {
    const store = getApp().globalData.userStore
    this.setData({
      centerList: (store.couponCenter || []).map(decorateCenterCoupon),
      allCoupons: store.coupons || []
    })
    this.applyFilter()
    this.applyCenterVisible()
  },

  applyFilter() {
    const list = (this.data.allCoupons || [])
      .filter((item) => item.status === this.data.active)
      .map(decorateMyCoupon)
    const visibleList = this.data.couponListExpanded ? list : list.slice(0, MY_COUPON_PREVIEW_SIZE)
    this.setData({
      list,
      visibleList,
      showCouponListToggle: list.length > MY_COUPON_PREVIEW_SIZE,
      couponListToggleText: this.data.couponListExpanded
        ? '收起'
        : `展开更多 ${Math.max(list.length - visibleList.length, 0)} 张`
    })
  },

  applyCenterVisible() {
    const centerList = this.data.centerList || []
    const visibleCenterList = this.data.centerListExpanded
      ? centerList
      : centerList.slice(0, CENTER_COUPON_PREVIEW_SIZE)
    this.setData({
      visibleCenterList,
      showCenterToggle: centerList.length > CENTER_COUPON_PREVIEW_SIZE,
      centerToggleText: this.data.centerListExpanded
        ? '收起'
        : `展开更多 ${Math.max(centerList.length - visibleCenterList.length, 0)} 张`
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

  async claimCoupon(e) {
    const coupon = e.detail && e.detail.item
    const couponId = (e.detail && e.detail.id) || (e.currentTarget && e.currentTarget.dataset.id)
    if (coupon && coupon.actionDisabled) return
    await receiveCoupon(couponId)
    wx.showToast({
      title: '\u4f18\u60e0\u5238\u9886\u53d6\u6210\u529f',
      icon: 'success'
    })
    await this.refreshList()
  },

  handleSelect() {}
})
