import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    watch: {
      usePolling: true
    },
    /* ── Proxy flag CDN so flags load without CORS issues ── */
    proxy: {
      "/flags": {
        target: "https://flagcdn.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/flags/, ""),
      },
    },
  },
  resolve: {
    alias: {
      "@": "/src"
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          pdf: ["@react-pdf/renderer"]
        }
      }
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  optimizeDeps: {
    include: ["@react-pdf/renderer"],
    esbuildOptions: {
      target: "esnext"
    }
  }
});
