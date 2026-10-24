import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.PORT || 53901)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.apng': 'image/apng',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const rel = decodeURIComponent(url.pathname === '/' ? '/preview/preview.html' : url.pathname)
    const file = path.join(root, rel)
    if (!file.startsWith(root)) {
      res.writeHead(403).end()
      return
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found')
        return
      }
      res.writeHead(200, {
        'content-type': types[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      })
      res.end(data)
    })
  })
  .listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`))

