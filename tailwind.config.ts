import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2D6A4F',
          50:  '#EAF4EF',
          100: '#C8E6D5',
          200: '#95CEAB',
          300: '#62B581',
          400: '#3D9163',
          500: '#2D6A4F',
          600: '#245540',
          700: '#1A4030',
          800: '#112B20',
          900: '#091510',
        },
        confidence: {
          high: '#16A34A',
          mid:  '#EAB308',
          low:  '#DC2626',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans KR"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
