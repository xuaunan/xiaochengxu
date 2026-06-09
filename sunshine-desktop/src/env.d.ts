/// <reference types="vite/client" />

export {}

declare global {
  interface Window {
    sunshineDesktop?: {
      getAppInfo: () => Promise<{ version: string; platform: string; isPackaged: boolean }>
      controlWindow: (action: 'minimize' | 'maximize' | 'close') => Promise<boolean>
      openExternal: (url: string) => Promise<boolean>
    }
  }
}
