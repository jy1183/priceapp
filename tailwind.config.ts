import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}', './viewer/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
