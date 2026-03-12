import path from "node:path";

export default {
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "::1",
      "officialmerch.tech",
      "www.officialmerch.tech",
    ],
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  }
}
