/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#e0f7fa",
          100: "#b2ebf2",
          200: "#80deea",
          300: "#4dd0e1",
          400: "#26c6da",
          500: "#00bcd4",
          600: "#00acc1",
          700: "#0097a7",
          800: "#00838f",
          900: "#006064",
          950: "#004d40"
        },
        ocean: {
          50: "#e3f2fd",
          100: "#bbdefb",
          200: "#90caf9",
          300: "#64b5f6",
          400: "#42a5f5",
          500: "#2196f3",
          600: "#1e88e5",
          700: "#1976d2",
          800: "#1565c0",
          900: "#0d47a1"
        },
        pool: {
          50: "#e8f5e9",
          100: "#c8e6c9",
          200: "#a5d6a7",
          300: "#81c784",
          400: "#66bb6a",
          500: "#4caf50",
          600: "#43a047",
          700: "#388e3c",
          800: "#2e7d32",
          900: "#1b5e20"
        },
        aqua: {
          50: "#e0f7fa",
          100: "#b2ebf2",
          200: "#80deea",
          300: "#4dd0e1",
          400: "#26c6da",
          500: "#00bcd4",
          600: "#00acc1",
          700: "#0097a7",
          800: "#00838f",
          900: "#006064"
        },
        swim: {
          deep: "#003d52",
          mid: "#005f73",
          bright: "#0077a8",
          light: "#0095c8"
        },
        slate: {
          850: "#0c1929",
          950: "#061019"
        }
      },
      fontFamily: {
        sans: ["Nunito", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      backgroundImage: {
        "swim-gradient": "linear-gradient(135deg, #003d52 0%, #005f73 25%, #0077a8 50%, #006080 75%, #004a6e 100%)",
        "pool-waves": "linear-gradient(180deg, #003d52 0%, #005f73 50%, #006080 100%)",
        "aqua-gradient": "linear-gradient(135deg, #00bcd4 0%, #2196f3 50%, #0097a7 100%)",
        "card-gradient": "linear-gradient(135deg, rgba(0,119,168,0.3) 0%, rgba(0,150,200,0.15) 100%)"
      }
    }
  },
  plugins: []
};
