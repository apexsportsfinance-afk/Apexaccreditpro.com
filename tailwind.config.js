/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      colors: {
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49"
        },
        ocean: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
          950: "#083344"
        },
        aqua: {
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490"
        },
        "swim-deep": "#050d1f"
      },
      animation: {
        "wave-slow": "wave 8s ease-in-out infinite",
        "wave-medium": "wave 6s ease-in-out infinite reverse",
        "wave-fast": "wave 4s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite"
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "translateX(0) translateY(0)" },
          "25%": { transform: "translateX(-10px) translateY(-5px)" },
          "75%": { transform: "translateX(10px) translateY(5px)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      },
      boxShadow: {
        "glow-cyan": "0 0 20px rgba(6, 182, 212, 0.3)",
        "glow-blue": "0 0 20px rgba(59, 130, 246, 0.3)",
        "glow-primary": "0 0 20px rgba(14, 165, 233, 0.3)"
      }
    }
  },
  plugins: []
};
