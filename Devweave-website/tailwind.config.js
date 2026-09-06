/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        primary: "#FFFFFF",
        secondary: "rgba(255,255,255,0.70)",
        muted: "rgba(255,255,255,0.45)",
        accent: {
          blue: "#4F8CFF",
          cyan: "#6EE7FF",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'serif'],
      },
    },
  },
  plugins: [],
}
