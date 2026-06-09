import { contextBridge, ipcRenderer } from 'electron'

const windowActions = new Set(['minimize', 'maximize', 'close'])

contextBridge.exposeInMainWorld('sunshineDesktop', {
  getAppInfo: () => ipcRenderer.invoke('sunshine:app-info'),
  controlWindow: (action: 'minimize' | 'maximize' | 'close') => {
    if (!windowActions.has(action)) return Promise.resolve(false)
    return ipcRenderer.invoke('sunshine:window-control', action)
  },
  openExternal: (url: string) => ipcRenderer.invoke('sunshine:open-external', url)
})
