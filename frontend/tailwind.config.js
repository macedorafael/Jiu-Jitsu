/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Gracie Barra: vermelho + preto
        primary: {
          50:  '#fff0f0',
          100: '#ffd6d6',
          200: '#ffadad',
          300: '#ff7070',
          400: '#ff3333',
          500: '#cc0000',   // GB Red
          600: '#a80000',
          700: '#850000',
          800: '#620000',
          900: '#3d0000',
        },
        gb: {
          black:    '#0d0d0d',
          darkgray: '#1a1a1a',
          gray:     '#2a2a2a',
          red:      '#cc0000',
          redlight: '#e60000',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
