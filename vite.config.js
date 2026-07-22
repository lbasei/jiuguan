import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleApiRequest } from './api/db.mjs'

// 本地开发也复用 api/db.mjs；Gemini 密钥只由服务端读取。
// 仅 dev 生效；生产部署需另配后端代理（纯前端调 LLM 会暴露 key，仅适合 demo）。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const openaiKey = env.OPENAI_API_KEY || ''

  return {
    plugins: [
      react(),
      {
        name: 'life-kitchen-local-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith('/api')) {
              next()
              return
            }
            await handleApiRequest(req, res)
          })
        },
      },
    ],
    server: {
      port: 5173,
      strictPort: true,
      open: true,
      proxy: {
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
