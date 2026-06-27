import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent, 221 83% 53%))",
          foreground: "hsl(var(--accent-foreground, 0 0% 100%))"
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar, 222 47% 11%))",
          foreground: "hsl(var(--sidebar-foreground, 210 20% 82%))"
        }
      },
      borderRadius: {
        xl: "12px",
        lg: "8px",
        md: "6px",
        sm: "4px"
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
        md: "0 2px 4px -1px rgb(0 0 0 / 0.04), 0 4px 6px -1px rgb(0 0 0 / 0.06)",
        lg: "0 4px 6px -2px rgb(0 0 0 / 0.03), 0 10px 15px -3px rgb(0 0 0 / 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
