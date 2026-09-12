/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        // UI, bảng số liệu, form — Inter đọc rõ ở cỡ nhỏ và có chữ số canh đều.
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        // Tiêu đề trang / tên thương hiệu — phong cách báo tài chính (kiểu
        // WSJ/FT), dùng qua thẻ h1/h2 (xem index.css) chứ không phải mặc định
        // toàn trang.
        serif: ['"Source Serif 4"', 'Georgia', '"Times New Roman"', 'serif'],
      },
    },
  },
  plugins: [],
}
