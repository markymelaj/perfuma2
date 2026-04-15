import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: '#27272a',
        card: '#09090b',
        muted: '#71717a',
        foreground: '#fafafa',
      },
    },
  },
  plugins: [],
};

export default config;
