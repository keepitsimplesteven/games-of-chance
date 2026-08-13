import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "rotate-hint": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-15deg)" },
          "75%": { transform: "rotate(15deg)" },
        },
        "coin-flip": {
          "0%": { transform: "rotateX(0deg)" },
          "100%": { transform: "rotateX(1800deg)" },
        },
        "coin-land": {
          "0%": { transform: "rotateX(1800deg) scale(1)" },
          "50%": { transform: "rotateX(1800deg) scale(1.1)" },
          "100%": { transform: "rotateX(1800deg) scale(1)" },
        },
        "result-reveal": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.9)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "rotate-hint": "rotate-hint 2s ease-in-out infinite",
        "coin-flip": "coin-flip 1.5s ease-out forwards",
        "coin-land": "coin-land 0.3s ease-out forwards",
        "result-reveal": "result-reveal 0.4s ease-out forwards",
      },
    },
  },
  plugins: [],
}

export default config
