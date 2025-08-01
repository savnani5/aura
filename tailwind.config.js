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
      // Enhanced responsive breakpoints
      screens: {
        'xs': '475px',
        'meeting': {'raw': '[data-theme="meeting"]'},
        '3xl': '1680px',
        '4xl': '2048px',
      },
      // Mobile-friendly spacing and sizing
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      // Touch-friendly minimum sizes
      minHeight: {
        'touch': '44px', // iOS HIG minimum touch target
        'touch-lg': '48px', // Material Design minimum
      },
      minWidth: {
        'touch': '44px',
        'touch-lg': '48px',
      },
      // Mobile-optimized font sizes
      fontSize: {
        'xs-mobile': ['0.75rem', { lineHeight: '1.2' }],
        'sm-mobile': ['0.875rem', { lineHeight: '1.3' }],
        'base-mobile': ['1rem', { lineHeight: '1.4' }],
        'lg-mobile': ['1.125rem', { lineHeight: '1.4' }],
      },
    },
  },
  plugins: [],
} 