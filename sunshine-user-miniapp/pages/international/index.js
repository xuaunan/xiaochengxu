const { buildInternationalOptions, getInternationalExchangeRate } = require('../../utils/user-store')

Page({
  data: {
    exchangeRate: '',
    metrics: [],
    options: [],
    pageTitle: '国际出行',
    pageSubtitle: '跨境接送机、商务包车、企业预约与后台实时同步的一体化出行服务'
  },

  onShow() {
    const rate = getInternationalExchangeRate()
    this.setData({
      exchangeRate: `实时后台汇率：1 美元 ≈ ${rate.toFixed(2)} 人民币`,
      metrics: [
        { label: '服务城市', value: '港澳/沪深' },
        { label: '结算币种', value: 'USD' },
        { label: '同步方式', value: '实时订单' }
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
