/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0d1117',
          bgDeep: '#090d16',
          surface: '#161b22',
          surfaceHover: '#1c2128',
          surfaceActive: '#21262d',
          border: '#30363d',
          borderSubtle: '#21262d',
          borderMuted: '#3d444d',
          text: '#f0f6fc',
          textSecondary: '#c9d1d9',
          textMuted: '#8b949e',
        },
        status: {
          running: '#10b981',
          starting: '#f59e0b',
          stopped: '#64748b',
          offline: '#ef4444',
        },
        theme: {
          accent: 'var(--theme-accent)',
          'accent-hover': 'var(--theme-accent-hover)',
          'accent-text': 'var(--theme-accent-text)',
          'accent-border': 'var(--theme-accent-border)',
          'badge-bg': 'var(--theme-badge-bg)',
          'badge-text': 'var(--theme-badge-text)',
          'accent-glow': 'var(--theme-accent-glow)',
          ring: 'var(--theme-ring)',
        },
        // Mapped legacy tokens for safety
        cyber: {
          bg: '#0d1117',
          surface: '#161b22',
          surfaceHover: '#1c2128',
          card: '#161b22',
          cardHover: '#1c2128',
          border: '#30363d',
          borderLight: '#3d444d',
          accent: '#e6edf3',
          accentHover: '#ffffff',
          emerald: '#10b981',
          emeraldGlow: '#059669',
          amber: '#f59e0b',
          rose: '#ef4444',
          violet: '#a855f7',
          cyan: '#e6edf3',
          muted: '#8b949e',
          text: '#f0f6fc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 1px 2px -1px rgba(0, 0, 0, 0.5)',
        overlay: '0 10px 30px -5px rgba(0, 0, 0, 0.8), 0 4px 6px -2px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
