/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          blue: "#0A4E9B",
          darkblue: "#063A75",
          gray: "#F4F6F9",
          border: "#E2E8F0"
        }
      }
    },
  },
  plugins: [],
}
