/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    screens: {
      sm: '320px',
      md: '768px',
      lg: '1024px',
      xl: '1440px'
    },

    extend: {
      colors: {
        // Core elite palette
        base: '#0b0f1a', // Refined Navy Base (Slightly lighter than #020617)
        glass: 'rgba(15, 23, 42, 0.4)', // Glass Layer
        primary: {
          DEFAULT: '#22d3ee', // Apex Cyan
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        whiteElite: '#f8fafc',

        // Functional states
        success: '#10b981',
        warning: '#f59e0b',
        critical: '#dc2626',
        inactive: '#475569'
      },

      fontFamily: {
        heading: ['Outfit', 'sans-serif'], // Elite & Commanding
        body: ['Inter', 'sans-serif'], // Precise & Reliable
        mono: ['JetBrains Mono', 'monospace']
      },

      fontSize: {
        h1: ['24px', { lineHeight: '1.2', letterSpacing: '0.05em', fontWeight: '900' }],
        h2: ['14px', { lineHeight: '1.2', letterSpacing: '0.15em', fontWeight: '700' }],
        body: ['12px', { lineHeight: '1.5' }],
        meta: ['8px', { letterSpacing: '0.3em', fontWeight: '900' }]
      },

      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '40px'
      },

      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        full: '999px'
      },

      boxShadow: {
        cyanGlow: '0 0 12px rgba(34, 211, 238, 0.2)',
        successGlow: '0 0 12px rgba(16, 185, 129, 0.1)'
      },

      backdropBlur: {
        xs: '4px',
        sm: '8px',
        md: '12px'
      },

      transitionTimingFunction: {
        apex: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  },
  plugins: []
}
