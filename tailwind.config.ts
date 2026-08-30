import type { Config } from 'tailwindcss';

/**
 * Design tokens from the spec live here so components never hardcode hex
 * values. Names are semantic (`surface`, `accent`) rather than literal, so a
 * theme change is a config edit.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#121212',
        surface: {
          DEFAULT: '#181818',
          raised: '#1f1f1f',
          hover: '#282828',
        },
        accent: {
          DEFAULT: '#1DB954',
          hover: '#1ed760',
          muted: '#14833b',
        },
        muted: '#9ca3af',
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '10px',
      },
      transitionDuration: {
        DEFAULT: '250ms',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        /**
         * Travel distance comes from `--marquee-distance`, set at runtime to the
         * measured overflow in px. The dwell at each end (0-12%, 88-100%) makes
         * the start and end of the title readable instead of continuously
         * sliding.
         */
        marquee: {
          '0%, 12%': { transform: 'translateX(0)' },
          '88%, 100%': { transform: 'translateX(calc(-1 * var(--marquee-distance, 0px)))' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        marquee: 'marquee 12s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
} satisfies Config;
