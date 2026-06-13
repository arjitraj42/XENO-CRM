/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#fafafa',
        panel: '#ffffff',
        card: '#ffffff',
        accent: {
          blue: '#1d4ed8',
          cyan: '#0e7490',
          emerald: '#047857',
          violet: '#6d28d9',
          rose: '#be123c',
          amber: '#b45309'
        },
        border: '#e4e4e7',
        mutedText: '#71717a',
        highlightText: '#09090b'
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
