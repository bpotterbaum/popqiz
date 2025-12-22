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
        background: "#00486D",
        surface: "#FFFFFF",
        "text-primary": "#FFFFFF", // Light text for dark background
        "text-primary-dark": "#1F2937", // Dark text for light surfaces
        "text-secondary": "#E0E0E0", // Light secondary text for dark background
        "text-secondary-dark": "#6B7280", // Dark secondary text for light surfaces
        
        // Brand & Action Color
        brand: "#FCB107", // Primary (temp)
        secondary: "#02ACC2", // Secondary (temp)
        tertiary: "#E50846", // Tertiary (temp)
        
        // Team Colors
        yellow: "#FDBA2D",
        teal: "#2EC4D6",
        red: "#E63946",
        orange: "#F77F00",
        "light-blue": "#7ED6DF",
        pink: "#FF85C0",
        lime: "#B6E600",
        white: "#FFFFFF",
        
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

