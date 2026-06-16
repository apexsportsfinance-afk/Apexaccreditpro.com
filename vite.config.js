import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png', 'apex-logo.png'],
      manifest: {
        name: 'Apex Unified Scanner',
        short_name: 'Apex Scanner',
        description: 'Professional high-speed hardware scanner interface.',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Only cache static assets for offline shell in Phase 1
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // Exclude API routes from offline cache
        navigateFallbackDenylist: [/^\/api/]
      }
    })
  ],
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
  esbuild: {
    // Remove console.log/debug/info calls in production; keep console.warn and console.error
    pure: process.env.NODE_ENV === "production" ? ["console.log", "console.debug", "console.info"] : [],
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
