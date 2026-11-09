import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#ffa31a",
        muted: "#808080",
        panel: "#292929",
        ink: "#1b1b1b",
      },
      fontFamily: {
        sans: ["Inter", "Arial", "Helvetica", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
