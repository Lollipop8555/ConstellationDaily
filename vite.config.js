import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 使用相对 base，构建产物可直接部署到 GitHub Pages 的任意子路径
// （例如 https://<user>.github.io/<repo>/），无需硬编码仓库名。
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2019',
  },
  server: {
    host: true,
    port: 5173,
  },
})
