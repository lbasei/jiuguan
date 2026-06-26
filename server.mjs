import { createServer } from 'node:http'
import { handleApiRequest } from './api/db.mjs'

const port = Number(process.env.PORT || 8787)
const host = process.env.HOST || '127.0.0.1'

const server = createServer(async (req, res) => {
  const handled = await handleApiRequest(req, res)
  if (handled) return
  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ error: 'Life Kitchen API only serves /api/*' }))
})

server.listen(port, host, () => {
  console.log(`Life Kitchen API listening on http://${host}:${port}`)
})
