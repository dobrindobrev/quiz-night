import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        paper: "var(--paper)",
        card: "var(--card)",
        muted: "var(--muted)",
        lime: "var(--lime)",
        mag: "var(--mag)",
        cobalt: "var(--cobalt)",
        sun: "var(--sun)",
        mint: "var(--mint)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        lg: "22px",
        xl: "32px",
      },
      boxShadow: {
        sm: "3px 3px 0 var(--ink)",
        md: "5px 5px 0 var(--ink)",
        lg: "8px 8px 0 var(--ink)",
      },
      animation: {
        pop: "pop 0.3s ease",
        slideUp: "slideUp 0.25s ease",
        pulse2: "pulse2 1s infinite",
        confetti: "confettiFall 2.4s ease-in forwards",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "60%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        slideUp: {
          from: { transform: "translateY(20px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        pulse2: {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
        confettiFall: {
          "0%": { transform: "translateY(-20px) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(120vh) rotate(720deg)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
