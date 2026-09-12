import type { Config } from 'tailwindcss';

// Every colour maps to a CSS custom property declared in src/styles/tokens.css so light and
// dark themes are one token set and components never hardcode a hue.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        'surface-3': v('surface-3'),
        line: v('line'),
        'line-strong': v('line-strong'),
        ink: v('ink'),
        'ink-2': v('ink-2'),
        'ink-3': v('ink-3'),
        primary: { DEFAULT: v('primary'), strong: v('primary-strong'), soft: v('primary-soft'), fg: v('primary-fg') },
        accent: { DEFAULT: v('accent'), soft: v('accent-soft') },
        low: { DEFAULT: v('low'), soft: v('low-soft') },
        medium: { DEFAULT: v('medium'), soft: v('medium-soft') },
        high: { DEFAULT: v('high'), soft: v('high-soft') },
        critical: { DEFAULT: v('critical'), soft: v('critical-soft') },
        info: { DEFAULT: v('info'), soft: v('info-soft') },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(20 32 43 / 0.06), 0 0 0 1px rgb(var(--line) / 1)',
        pop: '0 12px 32px rgb(20 32 43 / 0.16)',
      },
      borderRadius: { xl2: '14px' },
    },
  },
  plugins: [],
} satisfies Config;
