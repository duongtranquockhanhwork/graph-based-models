import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Mặc định trỏ localhost để `npm run dev` chạy được ngay trên máy host.
      // Trong Docker Compose, đặt VITE_API_TARGET=http://backend:8000.
      // Bản trước hard-code tên service Docker, nên mọi request /api đều lỗi
      // khi chạy dev ngoài container — dù README hướng dẫn cách chạy đó.
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
