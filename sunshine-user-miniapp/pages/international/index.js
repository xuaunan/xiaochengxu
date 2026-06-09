const { buildInternationalOptions, getInternationalExchangeRate } = require('../../utils/user-store')

Page({
  data: {
    exchangeRate: '',
    metrics: [],
    routeCodes: [],
    options: [],
    pageTitle: '国际出行',
    pageSubtitle: '机场接送、口岸通行、商务预约与多币种结算一站完成'
  },

  onShow() {
    const rate = getInternationalExchangeRate()
    this.setData({
      exchangeRate: `当前汇率：1 美元 ≈ ${rate.toFixed(2)} 人民币`,
      routeCodes: [
        { code: 'HKG', label: 'Hong Kong' },
        { code: 'MFM', label: 'Macau' },
        { code: 'PVG', label: 'Shanghai' }
      ],
      metrics: [
        { label: '机场/口岸', value: '3 条' },
        { label: '结算币种', value: 'USD' },
        { label: '预约状态', value: '实时' }
      ],
      options: buildInternationalOptions()
    })
  },

  openOrder(e) {
    wx.navigateTo({
      url: `/pages/international-order/index?id=${e.currentTarget.dataset.id}`
    })
  },

  openList() {
    wx.navigateTo({ url: '/pages/international-orders/index' })
  }
})
