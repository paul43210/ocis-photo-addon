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
      formats: ['amd']
    },
    rollupOptions: {
      external: ['vue', '@ownclouders/web-pkg', '@ownclouders/web-client', 'vue3-gettext'],
      output: {
        // Remove named AMD id to create anonymous module like official extensions
        globals: {
          'vue': 'Vue',
          '@ownclouders/web-pkg': '@ownclouders/web-pkg',
          '@ownclouders/web-client': '@ownclouders/web-client',
          'vue3-gettext': 'vue3-gettext'
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
