import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--cr-page)",
        panel: "var(--cr-panel)",
        ink: "var(--cr-text)",
        muted: "var(--cr-muted)",
        line: "var(--cr-border)",
        primary: "var(--cr-primary)",
        "primary-soft": "var(--cr-primary-soft)",
        selection: "var(--cr-selection)",
        success: "var(--cr-success)",
        warning: "var(--cr-warning)",
        danger: "var(--cr-danger)",
      },
      fontFamily: {
        sans: ["'Segoe UI'", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        product: ["16px", "22px"],
        title: ["21px", "28px"],
        section: ["14px", "20px"],
        body: ["13px", "20px"],
        table: ["12px", "18px"],
        meta: ["11px", "16px"],
      },
      borderRadius: {
        panel: "7px",
        control: "4px",
      },
      spacing: {
        page: "18px",
        "page-narrow": "12px",
        rail: "168px",
      },
    },
  },
  plugins: [],
};

export default config;
