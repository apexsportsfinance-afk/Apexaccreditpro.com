import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    watch: { usePolling: true },
    proxy: {
      "/flags": {
        target: "https://flagcdn.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/flags/, ""),
      },
    },
  },
  resolve: {
    alias: { "@": "/src" }
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    cssMinify: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-motion": ["motion"],
          "vendor-pdf": ["jspdf", "jspdf-autotable"],
          "vendor-canvas": ["html2canvas"],
          "vendor-qr": ["qrcode"],
          "vendor-zip": ["jszip"],
          "vendor-xlsx": ["xlsx"],
          "vendor-icons": ["lucide-react"],
        },
        entryFileNames: "js/[name]-[hash]-v4.js",
        chunkFileNames: "js/[name]-[hash]-v4.js",
        assetFileNames: (info) => {
          if (info.name?.endsWith(".css")) return "css/[name]-[hash]-v4[extname]";
          return "assets/[name]-[hash]-v4[extname]";
        },
      }
    },
    commonjsOptions: { transformMixedEsModules: true }
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@supabase/supabase-js",
      "motion",
      "lucide-react",
      "date-fns"
    ],
    exclude: [
      "html2canvas",
      "jspdf",
      "jspdf-autotable",
      "jszip",
      "qrcode",
      "xlsx"
    ],
    esbuildOptions: { target: "esnext" }
  }
});
