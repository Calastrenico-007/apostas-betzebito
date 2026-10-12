import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#07111f',
        panel: '#0d1a2c',
        panel2: '#142541',
        panel3: '#1b3150',
        line: 'rgba(255, 255, 255, 0.08)',
        'line-strong': 'rgba(255, 255, 255, 0.14)',
        muted: '#8e9eaf',
        'muted-light': '#b3c1d1',
        brand: {
          DEFAULT: '#3b82f6',
          light: '#60a5fa',
          mint: '#bfdbfe',
          dark: '#2563eb',
          ink: '#061326',
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
        flashUp: { '0%': { backgroundColor: 'rgba(59, 130, 246, 0.45)' }, '100%': { backgroundColor: 'transparent' } },
        flashDown: { '0%': { backgroundColor: 'rgba(239, 68, 68, 0.45)' }, '100%': { backgroundColor: 'transparent' } },
        ticker: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(-100%)' } },
      },
      animation: {
        flashUp: 'flashUp 1.2s ease-out',
        flashDown: 'flashDown 1.2s ease-out',
        ticker: 'ticker 35s linear infinite',
      },
      boxShadow: {
        glow: '0 0 25px rgba(59, 130, 246, 0.24)',
        'glow-sm': '0 0 12px rgba(59, 130, 246, 0.22)',
        card: '0 14px 34px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};
export default config;
