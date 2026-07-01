/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: 'var(--wm-bg)',
        nav: 'var(--wm-nav)',
        surface: 'var(--wm-surface)',
        'surface-2': 'var(--wm-surface-2)',
        line: 'var(--wm-line)',
        'line-strong': 'var(--wm-line-strong)',
        // Foreground / text
        fg: {
          DEFAULT: 'var(--wm-fg)',
          secondary: 'var(--wm-fg-secondary)',
          muted: 'var(--wm-fg-muted)',
        },
        // Brand
        primary: {
          DEFAULT: 'var(--wm-primary)',
          fg: 'var(--wm-primary-fg)',
          soft: 'var(--wm-primary-soft)',
          strong: 'var(--wm-primary-strong)',
          hover: 'var(--wm-primary-hover)',
        },
        accent: 'var(--wm-accent)',
        // Code
        'code-bg': 'var(--wm-code-bg)',
        'code-fg': 'var(--wm-code-fg)',
        // Semantic tones (base / soft bg / on-soft text / soft border)
        success: { DEFAULT: 'var(--wm-success)', soft: 'var(--wm-success-soft)', fg: 'var(--wm-success-fg)', line: 'var(--wm-success-line)' },
        warning: { DEFAULT: 'var(--wm-warning)', soft: 'var(--wm-warning-soft)', fg: 'var(--wm-warning-fg)', line: 'var(--wm-warning-line)' },
        danger: { DEFAULT: 'var(--wm-danger)', soft: 'var(--wm-danger-soft)', fg: 'var(--wm-danger-fg)', line: 'var(--wm-danger-line)' },
        info: { DEFAULT: 'var(--wm-info)', soft: 'var(--wm-info-soft)', fg: 'var(--wm-info-fg)', line: 'var(--wm-info-line)' },
        neutral: { soft: 'var(--wm-neutral-soft)', fg: 'var(--wm-neutral-fg)', line: 'var(--wm-neutral-line)' },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'wm-sm': '9px',
        wm: '14px',
        'wm-card': '16px',
        pill: '999px',
      },
      boxShadow: {
        'wm-card': '0 1px 2px rgba(0,0,0,0.18), 0 8px 24px -12px rgba(0,0,0,0.30)',
        'wm-pop': '0 12px 40px -8px rgba(0,0,0,0.45)',
      },
      keyframes: {
        'wm-spin': { to: { transform: 'rotate(360deg)' } },
        'wm-pulse': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        'wm-shimmer': { '100%': { transform: 'translateX(100%)' } },
        'wm-skeleton': { '0%': { backgroundPosition: '-200px 0' }, '100%': { backgroundPosition: '200px 0' } },
        'wm-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'wm-scale-in': { from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        'wm-slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
      },
      animation: {
        'wm-spin': 'wm-spin 0.7s linear infinite',
        'wm-pulse': 'wm-pulse 1.6s ease-in-out infinite',
        'wm-skeleton': 'wm-skeleton 1.4s ease-in-out infinite',
        'wm-fade-in': 'wm-fade-in 0.15s ease-out',
        'wm-scale-in': 'wm-scale-in 0.16s cubic-bezier(0.16,1,0.3,1)',
        'wm-slide-in': 'wm-slide-in 0.22s cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [],
};
