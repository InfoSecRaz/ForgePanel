/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f0f0f',
        surface: '#1a1a1a',
        surface2: '#242424',
        border: '#2a2a2a',
        'text-primary': '#f1f1f1',
        'text-secondary': '#9ca3af',
        running: '#10b981',
        stopped: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
};
