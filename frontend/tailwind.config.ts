import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1F574A",
          50: "#E8F3EF",
          100: "#D4EBE3",
          200: "#A8D5C8",
          300: "#7BBFAE",
          400: "#4A9A84",
          500: "#2F7A64",
          600: "#1F574A",
          700: "#184439",
          800: "#12352D",
          900: "#0C241E",
        },
        secondary: {
          DEFAULT: "#2D6B5A",
          50: "#EAF5F0",
          100: "#D5EBE2",
          200: "#AED7C6",
          300: "#7FBEA5",
          400: "#4F9F82",
          500: "#34856A",
          600: "#2D6B5A",
          700: "#245648",
          800: "#1B4136",
          900: "#122C25",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F8FAFC",
        },
        border: {
          DEFAULT: "#E5E7EB",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover": "0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
        modal: "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.06)",
      },
      transitionProperty: {
        DEFAULT: "all",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [],
};
export default config;
