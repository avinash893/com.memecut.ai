/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx,html}', './index.html'],
  theme: {
    extend: {
      colors: {
        bg: '#0f0f11', surface: '#1a1a1f', surface2: '#242429',
        border: '#2e2e36', accent: '#f5c518', accent2: '#ff4f4f',
        muted: '#6b6b7a',
        funny: '#f5c518', angry: '#ff4f4f', sad: '#4fa3ff',
        surprised: '#b44fff', cringe: '#ff8c00', hype: '#00e5a0',
        fail: '#ff4f4f', rage: '#ff2020', victory: '#00e5a0',
        confusion: '#b44fff', sus: '#ff8c00', emotional: '#4fa3ff',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      }
    }
  },
  plugins: []
}
