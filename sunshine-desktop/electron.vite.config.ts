import { fileURLToPath } from 'node:url'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

const rendererEntry = fileURLToPath(new URL('./index.html', import.meta.url))

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: 'electron/main.ts'
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    build: {
      lib: {
        entry: 'electron/preload.ts'
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: rendererEntry
      }
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    plugins: [vue()]
  }
})
