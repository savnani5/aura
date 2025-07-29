/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Clean white theme with black accents
        primary: {
          DEFAULT: '#0a0a0a', // Pure black for buttons and primary elements
          50: '#f8f9fa',
          100: '#f1f3f4', 
          200: '#e9ecef',
          300: '#dee2e6',
          400: '#ced4da',
          500: '#adb5bd',
          600: '#6c757d',
          700: '#495057',
          800: '#343a40',
          900: '#212529',
          950: '#0a0a0a',
          foreground: '#ffffff'
        },
        background: '#ffffff',
        foreground: '#0a0a0a',
        card: {
          DEFAULT: '#ffffff',
          foreground: '#0a0a0a'
        },
        popover: {
          DEFAULT: '#ffffff',
          foreground: '#0a0a0a'
        },
        secondary: {
          DEFAULT: '#f8f9fa',
          foreground: '#0a0a0a'
        },
        muted: {
          DEFAULT: '#f8f9fa',
          foreground: '#6c757d'
        },
        accent: {
          DEFAULT: '#f8f9fa',
          foreground: '#0a0a0a'
        },
        destructive: {
          DEFAULT: '#dc3545',
          foreground: '#ffffff'
        },
        border: '#dee2e6',
        input: '#f8f9fa',
        ring: '#0a0a0a',
      },
      // Meeting-specific dark theme
      screens: {
        'meeting': {'raw': '[data-theme="meeting"]'},
      }
    },
  },
  plugins: [],
} 