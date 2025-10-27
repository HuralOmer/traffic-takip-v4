import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    host: true,
    proxy: {
      '/api': {
        target: 'http://172.18.0.5:3001',
        changeOrigin: true
      },
      '/test': {
        target: 'http://172.18.0.5:3001',
        changeOrigin: true
      }
    }
  },
})