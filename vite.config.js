import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  server: {
    host: true, // already needed for 0.0.0.0 hosting
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'tinklingly-fanatical-brinda.ngrok-free.dev' // <-- add your Ngrok host here
    ]
  }
})
