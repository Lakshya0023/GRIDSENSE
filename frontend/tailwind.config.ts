import type { Config } from "tailwindcss";

// NOTE: Tailwind v4 resolves tokens from the `@theme` block in
// src/app/globals.css, which is the single source of truth. This file is only
// loaded if globals.css adds an `@config` directive. It is kept in sync with
// the charcoal palette so it can never contradict what actually ships.

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        grid: {
          bg: {
            primary: "#121212",
            secondary: "#1A1A1A",
            panel: "#212121",
            elevated: "#262626",
          },
          border: {
            DEFAULT: "#2E2E2E",
            light: "#3D3D3D",
            focus: "#22D3EE",
          },
          cyan: {
            DEFAULT: "#00E5FF",
            dim: "#00B8CC",
            glow: "#00E5FF33",
            muted: "#00E5FF1A",
          },
          green: {
            DEFAULT: "#39FF88",
            dim: "#2BCC6B",
            glow: "#39FF8833",
          },
          yellow: {
            DEFAULT: "#FFD166",
            dim: "#CCA752",
            glow: "#FFD16633",
          },
          red: {
            DEFAULT: "#FF3B5C",
            dim: "#CC2F4A",
            glow: "#FF3B5C33",
            bright: "#FF4D6A",
          },
          purple: {
            DEFAULT: "#A78BFA",
            dim: "#8B5CF6",
            glow: "#A78BFA33",
          },
          text: {
            primary: "#F2F2F0",
            secondary: "#A8A8A6",
            tertiary: "#767674",
            muted: "#565654",
          },
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        "glow-cyan": "0 0 20px rgba(0, 229, 255, 0.15)",
        "glow-green": "0 0 20px rgba(57, 255, 136, 0.15)",
        "glow-yellow": "0 0 20px rgba(255, 209, 102, 0.15)",
        "glow-red": "0 0 20px rgba(255, 59, 92, 0.15)",
        "glow-purple": "0 0 20px rgba(181, 108, 255, 0.15)",
        "panel": "0 4px 24px rgba(0, 0, 0, 0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
