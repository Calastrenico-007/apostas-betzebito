import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#070d14',
        panel: '#0e1724',
        panel2: '#132032',
        panel3: '#18283e',
        line: 'rgba(255, 255, 255, 0.08)',
        'line-strong': 'rgba(255, 255, 255, 0.14)',
        muted: '#8e9eaf',
        'muted-light': '#b3c1d1',
        brand: {
          DEFAULT: '#10b981',
          light: '#34d399',
          mint: '#6ee7b7',
          dark: '#059669',
          ink: '#022415',
        },
        live: '#ef4444',
        gold: {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
          dark: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      keyframes: {
        flashUp: { '0%': { backgroundColor: 'rgba(16, 185, 129, 0.45)' }, '100%': { backgroundColor: 'transparent' } },
        flashDown: { '0%': { backgroundColor: 'rgba(239, 68, 68, 0.45)' }, '100%': { backgroundColor: 'transparent' } },
        ticker: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(-100%)' } },
      },
      animation: {
        flashUp: 'flashUp 1.2s ease-out',
        flashDown: 'flashDown 1.2s ease-out',
        ticker: 'ticker 35s linear infinite',
      },
      boxShadow: {
        glow: '0 0 25px rgba(16, 185, 129, 0.22)',
        'glow-sm': '0 0 12px rgba(16, 185, 129, 0.2)',
        card: '0 14px 34px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};
export default config;
