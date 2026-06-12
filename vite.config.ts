import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/', // 👈 REQUIRED for Hostinger temp domain

  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    allowedHosts: [
      'lntqrcode.com',
      'qrtool.centralindia.cloudapp.azure.com'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/system': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },


  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
