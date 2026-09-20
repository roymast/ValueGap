import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "https://me-west1-valuegap-43872.cloudfunctions.net",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
