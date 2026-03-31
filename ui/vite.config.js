import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Ensure assets load correctly from root URL path
  build: {
    outDir: '../public',
    emptyOutDir: true
  },
  server: {
    // If we run `npm run dev` in ui-v3, proxy API to the backend
    proxy: {
      '/api': {
        target: 'https://localhost:26780', // Default port, adjust if node uses different
        changeOrigin: true,
        secure: false
      }
    }
  }
})
