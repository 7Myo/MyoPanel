export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      colors: {
        snow: "#F7F7F8",
        smoke: "#050506",
        sage: {
          50: "#F4F8F5",
          100: "#E3EDE6",
          200: "#C5DBCB",
          300: "#A3C5AD",
          400: "#7DAB8B",
          500: "#5B8C6F",
          600: "#4A735A",
          700: "#3C5C48",
          800: "#324A3B",
          900: "#2A3D31",
          DEFAULT: "#5B8C6F"
        },
        earth: {
          50: "#FDF8F2",
          100: "#F9ECD8",
          200: "#F2D7AE",
          300: "#E8BC7E",
          400: "#DDA15E",
          500: "#C28549",
          600: "#A66D3A",
          700: "#875631",
          800: "#6E462B",
          900: "#5A3A25",
          DEFAULT: "#C28549"
        },
        clay: {
          50: "#FDF4F3",
          100: "#FAE4E2",
          200: "#F5CAC6",
          300: "#ECA49E",
          400: "#DD7870",
          500: "#C4645A",
          600: "#A84A40",
          700: "#8C3C34",
          800: "#73332D",
          900: "#5F2E29",
          DEFAULT: "#C4645A"
        },
        mist: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          DEFAULT: "#d4d4d8"
        }
      },
      boxShadow: {
        soft: "0 4px 24px rgba(16, 12, 8, 0.06)",
        card: "0 2px 8px rgba(16, 12, 8, 0.04), 0 8px 32px rgba(16, 12, 8, 0.04)",
        lift: "0 4px 16px rgba(16, 12, 8, 0.06), 0 12px 40px rgba(16, 12, 8, 0.04)",
        ring: "0 0 0 3px rgba(91, 140, 111, 0.15)"
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "12px",
        md: "16px",
        lg: "20px",
        xl: "24px"
      }
    }
  },
  plugins: []
};
