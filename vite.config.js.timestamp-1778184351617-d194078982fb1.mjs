// vite.config.js
import { defineConfig } from "file:///C:/Users/IchiroFelipe/MyFiles/personal/projects/githubprojects/photobooth/node_modules/vite/dist/node/index.js";
import vue from "file:///C:/Users/IchiroFelipe/MyFiles/personal/projects/githubprojects/photobooth/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import tailwindcss from "file:///C:/Users/IchiroFelipe/MyFiles/personal/projects/githubprojects/photobooth/node_modules/@tailwindcss/vite/dist/index.mjs";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\IchiroFelipe\\MyFiles\\personal\\projects\\githubprojects\\photobooth";
var vite_config_default = defineConfig({
  plugins: [
    vue(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler"
      }
    }
  },
  server: {
    host: true,
    // already needed for 0.0.0.0 hosting
    port: 5173,
    strictPort: true,
    allowedHosts: [
      "tinklingly-fanatical-brinda.ngrok-free.dev"
      // <-- add your Ngrok host here
    ]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxJY2hpcm9GZWxpcGVcXFxcTXlGaWxlc1xcXFxwZXJzb25hbFxcXFxwcm9qZWN0c1xcXFxnaXRodWJwcm9qZWN0c1xcXFxwaG90b2Jvb3RoXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxJY2hpcm9GZWxpcGVcXFxcTXlGaWxlc1xcXFxwZXJzb25hbFxcXFxwcm9qZWN0c1xcXFxnaXRodWJwcm9qZWN0c1xcXFxwaG90b2Jvb3RoXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9JY2hpcm9GZWxpcGUvTXlGaWxlcy9wZXJzb25hbC9wcm9qZWN0cy9naXRodWJwcm9qZWN0cy9waG90b2Jvb3RoL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnO1xyXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuXHJcbi8vIGh0dHBzOi8vdml0ZS5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIHBsdWdpbnM6IFtcclxuICAgIHZ1ZSgpLFxyXG4gICAgdGFpbHdpbmRjc3MoKSxcclxuICBdLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgY3NzOiB7XHJcbiAgICBwcmVwcm9jZXNzb3JPcHRpb25zOiB7XHJcbiAgICAgIHNjc3M6IHtcclxuICAgICAgICBhcGk6ICdtb2Rlcm4tY29tcGlsZXInLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHNlcnZlcjoge1xyXG4gICAgaG9zdDogdHJ1ZSwgLy8gYWxyZWFkeSBuZWVkZWQgZm9yIDAuMC4wLjAgaG9zdGluZ1xyXG4gICAgcG9ydDogNTE3MyxcclxuICAgIHN0cmljdFBvcnQ6IHRydWUsXHJcbiAgICBhbGxvd2VkSG9zdHM6IFtcclxuICAgICAgJ3RpbmtsaW5nbHktZmFuYXRpY2FsLWJyaW5kYS5uZ3Jvay1mcmVlLmRldicgLy8gPC0tIGFkZCB5b3VyIE5ncm9rIGhvc3QgaGVyZVxyXG4gICAgXVxyXG4gIH1cclxufSlcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE2WixTQUFTLG9CQUFvQjtBQUMxYixPQUFPLFNBQVM7QUFDaEIsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyxVQUFVO0FBSGpCLElBQU0sbUNBQW1DO0FBTXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLElBQUk7QUFBQSxJQUNKLFlBQVk7QUFBQSxFQUNkO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxxQkFBcUI7QUFBQSxNQUNuQixNQUFNO0FBQUEsUUFDSixLQUFLO0FBQUEsTUFDUDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxJQUNaLGNBQWM7QUFBQSxNQUNaO0FBQUE7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
