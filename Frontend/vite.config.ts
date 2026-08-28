import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Serve mock-billing/ as static files under /mock-billing/
  publicDir: 'public',
  server: {
    fs: {
      allow: ['.'],
    },
  },
})
