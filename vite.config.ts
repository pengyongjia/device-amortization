import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base: './' 使构建产物使用相对路径，可部署到任意子路径（Cloudflare Pages / GitHub Pages 均可）
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
});
