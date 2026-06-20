import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// dev 代理：浏览器打同源 /deepseek，Vite 转发到 DeepSeek，绕开 CORS。
// 仅 dev 生效；生产部署需另配后端代理（纯前端调 LLM 会暴露 key，仅适合 demo）。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const openaiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || ''

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      open: true,
      proxy: {
        '/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/deepseek/, ''),
        },
        '/openai': {
          target: 'https://api.openai.com/v1',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/openai/, ''),
          headers: openaiKey ? { Authorization: `Bearer ${openaiKey}` } : {},
        },
      },
    },
  }
})
