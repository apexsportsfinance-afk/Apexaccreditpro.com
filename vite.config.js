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
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name]-[hash]-v3.js',
        chunkFileNames: 'js/[name]-[hash]-v3.js',
        assetFileNames: (info) => {
          if (info.name.endsWith('.css')) return 'css/[name]-[hash]-v3[extname]';
          return 'assets/[name]-[hash]-v3[extname]';
        },
      }
    },
    commonjsOptions: { transformMixedEsModules: true }
  },
  optimizeDeps: {
    include: [
      "@react-pdf/renderer",
      "html2canvas",
      "jspdf",
      "jspdf-autotable"
    ],
    esbuildOptions: { target: "esnext" }
  }
});
