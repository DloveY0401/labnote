/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          700: '#1e40af',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
      },
      fontSize: {
        h1: ['18px', { fontWeight: '700' }],
        h2: ['13px', { fontWeight: '700', letterSpacing: '0.05em' }],
        body: ['13px', { fontWeight: '400' }],
        label: ['12px', { fontWeight: '400' }],
        caption: ['11px', { fontWeight: '400' }],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
};
