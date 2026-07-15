/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface1: 'var(--surface-1)',
        surface2: 'var(--surface-2)',
        surface3: 'var(--surface-3)',
        hairline: 'var(--border-hairline)',
        'hairline-strong': 'var(--border-hairline-strong)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        running: 'var(--status-running)',
        stopped: 'var(--status-stopped)',
        warning: 'var(--status-warning)',
        info: 'var(--status-info)'
      },
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)'
      },
      borderRadius: {
        button: 'var(--radius-button)',
        card: 'var(--radius-card)',
        input: 'var(--radius-input)',
        badge: 'var(--radius-badge)',
        modal: 'var(--radius-modal)',
        tab: 'var(--radius-tab)'
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      fontSize: {
        'page-title': ['24px', { lineHeight: '1.33', letterSpacing: '-0.012em', fontWeight: '400' }],
        'section-head': ['16px', { lineHeight: '1.5', fontWeight: '590' }],
        body: ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['13px', { lineHeight: '1.2', fontWeight: '400' }],
        label: ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        console: ['13px', { lineHeight: '1.6' }]
      },
      boxShadow: {
        none: 'none'
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        pulseDot: 'pulseDot 1s ease infinite',
        fadeIn: 'fadeIn 100ms ease',
        toastIn: 'toastIn 160ms ease'
      }
    }
  },
  plugins: []
};
