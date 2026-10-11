module.exports = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            "surface-container-lowest": "#ffffff",
            "secondary-container": "#316bf3",
            "on-background": "#131b2e",
            "inverse-surface": "#283044",
            "tertiary": "#003c36",
            "surface-tint": "#3755c3",
            "on-secondary": "#ffffff",
            "surface-container-low": "#f6f8fc",
            "surface-dim": "#d2d9f4",
            "secondary": "#0051d5",
            "primary": "#00288e",
            "surface-bright": "#faf8ff",
            "on-surface": "#0f172a",
            "surface-container-highest": "#e2e8f0",
            "error": "#dc2626",
            "error-container": "#fee2e2",
            "on-error-container": "#991b1b",
            "outline": "#cbd5e1",
            "outline-variant": "#e2e8f0",
            "surface": "#f8fafc",
            "primary-container": "#1e40af",
            "on-surface-variant": "#64748b",
            "on-primary": "#ffffff",
            "background": "#faf8ff",
            "surface-container": "#f1f5f9"
          },
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            display: ['Plus Jakarta Sans', 'sans-serif']
          }
        }
      }
    , content: ["./src/**/*.{js,jsx,json,html}"] };module.exports.plugins = [require('@tailwindcss/forms')];
