import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5180,
    strictPort: false,
    allowedHosts: true,
    hmr: { overlay: true },
    proxy: {
      '/api/bridge': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false
      }
    },
    watch: {
      // usePolling removed — it causes memory exhaustion on Windows
      // Native file watching (default) is stable and fast
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**']
    }
  },
  resolve: {
    alias: { 
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-framer': ['framer-motion'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
          'vendor-jspdf': ['jspdf'],
          'vendor-html2canvas': ['html2canvas'],
          'vendor-xlsx': ['xlsx'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  }
});
