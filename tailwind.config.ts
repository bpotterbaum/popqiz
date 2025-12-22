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
        // Base colors from UX.md
        background: "#F7F8FA",
        surface: "#FFFFFF",
        "text-primary": "#1F2937",
        "text-secondary": "#6B7280",
        
        // Brand & Action Color
        brand: "#6366F1", // Indigo
        
        // Team Colors
        orchid: "#C084FC",
        "sky-blue": "#60A5FA",
        mint: "#34D399",
        peach: "#FB7185",
        gold: "#FBBF24",
        
        // Feedback & Status Colors
        success: "#22C55E",
        skip: "#9CA3AF",
        warning: "#F97316",
      },
    },
  },
  plugins: [],
};
export default config;

