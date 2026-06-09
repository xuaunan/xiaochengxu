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
    },
    theme: {
      type: String,
      value: 'orange'
    }
  },

  methods: {
    handleTap() {
      if (this.data.item && this.data.item.cardDisabled) return
      this.triggerEvent('select', { item: this.data.item })
    },
    handleAction(e) {
      if (this.data.item && this.data.item.actionDisabled) return
      this.triggerEvent('action', { id: e.currentTarget.dataset.id, item: this.data.item })
    },
    copyCode() {
      wx.setClipboardData({
        data: this.data.item.code
      })
    }
  }
})
