/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        'extra-tight': '-0.025em',
      },
      colors: {
        brick: {
          50:  '#fdf3ef',
          100: '#fae4dc',
          200: '#f5c9ba',
          300: '#eda489',
          400: '#e07558',
          500: '#c96040',
          600: '#b54f2e',
          700: '#9c4224',
          800: '#7a3420',
          900: '#682e1e',
          950: '#3a150c',
        },
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
        soft:   'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },
      boxShadow: {
        'card':    '0 1px 2px rgba(12, 10, 9, 0.04), 0 8px 24px -12px rgba(12, 10, 9, 0.08)',
        'card-hover': '0 1px 2px rgba(12, 10, 9, 0.06), 0 12px 32px -12px rgba(12, 10, 9, 0.12)',
        'inset-line': 'inset 0 -1px 0 rgba(12, 10, 9, 0.06)',
        'inner-top':  'inset 0 1px 0 rgba(255,255,255,0.9)',
        'inner-top-dark': 'inset 0 1px 0 rgba(255,255,255,0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-out',
        'slide-up': 'slideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 1.6s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}
