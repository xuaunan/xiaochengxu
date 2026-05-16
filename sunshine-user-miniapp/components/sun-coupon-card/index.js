Component({
  properties: {
    item: {
      type: Object,
      value: {}
    },
    selectable: {
      type: Boolean,
      value: false
    },
    selectedId: {
      type: String,
      value: ''
    }
  },

  methods: {
    handleTap() {
      this.triggerEvent('select', { item: this.data.item })
    },
    handleAction(e) {
      this.triggerEvent('action', { id: e.currentTarget.dataset.id, item: this.data.item })
    },
    copyCode() {
      wx.setClipboardData({
        data: this.data.item.code
      })
    }
  }
})
