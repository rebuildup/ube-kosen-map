import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function saveConfigPlugin() {
  return {
    name: 'save-config',
    configureServer(server: { middlewares: { use: (fn: (req: unknown, res: unknown, next: () => void) => void) => void } }) {
      server.middlewares.use((req: { url?: string; method?: string; on: (e: string, fn: (chunk: Buffer) => void) => void }, res: { setHeader: (k: string, v: string) => void; end: (s?: string) => void; statusCode: number }, next: () => void) => {
        if (req.url?.startsWith('/api/load-config') && req.method === 'GET') {
          try {
            const u = new URL(req.url!, `http://localhost`)
            const filename = u.searchParams.get('filename') ?? 'page1-inspect-config.json'
            const filepath = join(process.cwd(), 'data', filename)
            const raw = readFileSync(filepath, 'utf-8')
            const config = JSON.parse(raw)
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 200
            res.end(JSON.stringify(config))
          } catch {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'not found' }))
          }
          return
        }
        if (req.url?.startsWith('/api/save-config') && req.method === 'POST') {
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          req.on('end', () => {
            try {
              const raw = Buffer.concat(chunks).toString()
              const body = raw ? (JSON.parse(raw) as { filename?: string; config?: object }) : {}
              const filename = body.filename ?? 'page1-inspect-config.json'
              const config = body.config ?? {}
              const dataDir = join(process.cwd(), 'data')
              mkdirSync(dataDir, { recursive: true })
              const filepath = join(dataDir, filename)
              writeFileSync(filepath, JSON.stringify(config, null, 2), 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify({ ok: true, path: filepath }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ ok: false, error: String(err) }))
            }
          })
          return
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), saveConfigPlugin()],
  resolve: {
    alias: {
      '@/core': resolve(__dirname, 'src/core'),
      '@/editor': resolve(__dirname, 'src/editor'),
      '@/viewer': resolve(__dirname, 'src/viewer'),
      '@/math': resolve(__dirname, 'src/math'),
      '@/shared': resolve(__dirname, 'src/shared'),
      '@/components': resolve(__dirname, 'src/components'),
    },
  },
})
