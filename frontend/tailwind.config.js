/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7f0',
          100: '#feeede', 
          200: '#fcd9bd',
          300: '#f9bd8f',
          400: '#f59e0b',
          500: '#d97706',
          600: '#b45309',
          700: '#92400e',
          800: '#78350f',
          900: '#451a03',
        },
        red: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        mixjovim: {
          red: '#c62828',
          gold: '#f9a825',
          'red-dark': '#8e0000',
          'gold-light': '#ffd95a'
        },
        gray: {
          850: '#1f2937',
          900: '#111827',
          950: '#0d1117',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-mixjovim': 'linear-gradient(135deg, #c62828 0%, #8e0000 100%)',
        'gradient-gold': 'linear-gradient(135deg, #f9a825 0%, #ffd95a 100%)',
      }
    },
  },
  plugins: [],
} 