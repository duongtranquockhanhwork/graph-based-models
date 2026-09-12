import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // README và docker-compose đều nói cổng 3000. Không khai báo ở đây thì Vite
    // tự chọn 5173, nên hướng dẫn "mở http://localhost:3000" dẫn tới một trang
    // trắng. (CORS vẫn cho phép cả hai cổng, nên đây là lỗi hướng dẫn sai cổng,
    // không phải lỗi bị chặn.)
    //
    // strictPort: thà báo lỗi "cổng đã bận" còn hơn lặng lẽ nhảy sang cổng khác
    // rồi lại lệch khỏi tài liệu lần nữa.
    port: 3000,
    strictPort: true,
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
