import { defineConfig, type ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'

// Definir tipo para el proxy
const danbooruProxy: ProxyOptions = {
  target: 'https://danbooru.donmai.us',
  changeOrigin: true,
  rewrite: (path: string) => {
    const url = new URL('http://dummy' + path)
    const searchParams = url.searchParams
    const targetPath = searchParams.get('url') || 'posts.json'
    searchParams.delete('url')
    return `${targetPath}?${searchParams.toString()}`
  },
  headers: {
    'User-Agent': 'Booru-Explorer/1.0 (PROYECTO_EDUCATIVO)'
  }
}

export default defineConfig({
  plugins: [vue()],
  base: process.env.VERCEL ? '/' : '/Booru-Explorer/',
  server: {
    port: 3000,
    proxy: {
      '/api/danbooru': danbooruProxy
    }
  }
})