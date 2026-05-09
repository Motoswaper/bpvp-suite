import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#05070f",
        card: "#101523",
        accent: "#3b82f6",
        bpvp: {
          shell: "var(--bpvp-shell)",
          page: "var(--bpvp-page)",
          card: "var(--bpvp-card)",
          "card-dim": "var(--bpvp-card-dim)",
          border: "var(--bpvp-border)",
          "border-strong": "var(--bpvp-border-strong)",
          ink: "var(--bpvp-ink)",
          muted: "var(--bpvp-muted)",
          faint: "var(--bpvp-faint)",
          input: "var(--bpvp-input)",
          "input-border": "var(--bpvp-input-border)",
          hover: "var(--bpvp-hover)",
          "code-bg": "var(--bpvp-code-bg)"
        }
      }
    }
  },
  plugins: []
};

export default config;
