import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allow access from local network
    port: 5173,
    https: false, // Can be enabled with --https flag when needed for WebRTC
  },
  preview: {
    host: true,
    port: 4173,
    https: false,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          peerjs: ['peerjs']
        }
      }
    },
    // Optimize for production
    minify: 'esbuild',
    cssMinify: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000
  },
  // Ensure proper base path for deployment
  base: './',
  // Define for production builds
  define: {
    __DEV__: JSON.stringify(false)
  }
})
