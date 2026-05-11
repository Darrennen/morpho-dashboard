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
        morpho: {
          blue: "#2470FF",
          dark: "#0B0F1A",
          card: "#111827",
          border: "#1F2937",
        },
      },
    },
  },
  plugins: [],
};

export default config;
