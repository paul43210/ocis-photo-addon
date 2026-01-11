import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PhotoAddon',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['vue', '@ownclouders/web-pkg', '@ownclouders/web-client'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    },
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
