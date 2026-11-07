/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        elogia: {
          50: '#F5F8F5',
          100: '#E8EFE9',
          200: '#D2DFD4',
          300: '#B4C7B7',
          400: '#94AC98',
          500: '#758F79', // Verde Salvia Elogia
          600: '#5F7663',
          700: '#4B5E4F',
          800: '#39473C',
          900: '#263028',
          950: '#141A15',
        },
        brand: {
          50: '#F5F8F5',
          100: '#E8EFE9',
          500: '#758F79',
          600: '#5F7663',
          700: '#4B5E4F',
          900: '#263028',
        }
      }
    },
  },
  plugins: [],
}


