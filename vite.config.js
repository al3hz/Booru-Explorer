import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: process.env.VERCEL ? '/' : '/Booru-Explorer/',
  server: {
    port: 3000
  }
})