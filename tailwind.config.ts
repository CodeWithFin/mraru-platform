import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mraru palette (design doc Part 5 / 2.6) — deliberately not Wise's
        // actual brand colors, to keep this visually distinct from a
        // competing-category product.
        mraru: {
          lime: "#C8F169",
          forest: "#122B12",
          paper: "#FAFAF5",
          ink: "#161616",
          clay: "#E8623D",
          sky: "#5B8DEF",
          line: "#E4E4DC",
        },
      },
      borderRadius: {
        pill: "9999px",
        card: "28px",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "sans-serif"],
        // Not Wise's proprietary Wise Sans — General Sans/Founders Grotesk
        // are licensed display faces; add via next/font/local once the
        // team has the font files, this just reserves the token names.
        display: ["General Sans", "Founders Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
