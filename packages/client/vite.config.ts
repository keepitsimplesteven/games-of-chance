import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_PARTYKIT_HOST": JSON.stringify(
      process.env.PARTYKIT_HOST ?? "localhost:1999"
    ),
  },
})
