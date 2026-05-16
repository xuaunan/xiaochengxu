Component({
  properties: {
    driver: {
      type: Object,
      value: {}
    },
    etaText: {
      type: String,
      value: ''
    },
    actionText: {
      type: String,
      value: '联系司机'
    }
  },

  methods: {
    handleAction() {
      this.triggerEvent('action')
    }
  }
})
