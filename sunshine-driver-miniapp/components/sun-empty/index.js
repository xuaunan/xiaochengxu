Component({
  properties: {
    title: {
      type: String,
      value: '暂无数据'
    },
    description: {
      type: String,
      value: '当前还没有内容，稍后再来看看'
    },
    buttonText: {
      type: String,
      value: ''
    }
  },

  methods: {
    emitAction() {
      this.triggerEvent('action')
    }
  }
})
