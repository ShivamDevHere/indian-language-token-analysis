/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        navy: { 950: '#070d27', 900: '#0b1437', 800: '#111c4a', 700: '#1b2a63' },
      },
    },
  },
  plugins: [],
};
