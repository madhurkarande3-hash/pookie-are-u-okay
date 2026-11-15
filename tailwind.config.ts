import type { Config } from "tailwindcss";

/** Colours resolve to CSS variables generated from src/lib/theme/tokens.ts. */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--c-bg)",
        surface: "var(--c-surface)",
        primary: "var(--c-primary)",
        "primary-strong": "var(--c-primary-strong)",
        accent: "var(--c-accent)",
        ink: "var(--c-ink)",
        "ink-soft": "var(--c-ink-soft)",
        line: "var(--c-line)",
        ok: "var(--c-ok)",
        warn: "var(--c-warn)",
        danger: "var(--c-danger)",
      },
      fontFamily: { sans: "var(--font-body)" },
      borderRadius: { card: "var(--radius-card)", pill: "9999px" },
      boxShadow: { card: "var(--shadow-card)" },
      minHeight: { tap: "var(--tap)" },
      minWidth: { tap: "var(--tap)" },
    },
  },
  plugins: [],
};

export default config;
