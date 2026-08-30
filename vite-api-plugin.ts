import { readFileSync } from 'node:fs'
import type { Connect, Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * `vite dev` uchun `/api/*` middleware.
 *
 * Muammo: `api/` papkasidagi fayllar — Vercel serverless funksiyalari.
 * Ular faqat Vercel'da (yoki `vercel dev` bilan) ishlaydi. Oddiy
 * `vite dev` da ular yo'q, shuning uchun panelning API'ga tayanadigan
 * hamma qismi — statusni o'zgartirish, xabarnoma, kanal, lokatsiya —
 * lokalda "404" bilan tugardi. Natijada ishlab turgan kod ham buzuq
 * ko'rinardi.
 *
 * Bu plagin o'sha fayllarni Vite'ning o'z modul yuklagichi bilan chaqiradi
 * va Vercel'ning `req.body` / `res.status().json()` shakliga taqlid qiladi.
 * Faqat dev rejimida ishlaydi — production build'ga hech narsa qo'shmaydi.
 */
export function devApi(): Plugin {
  return {
    name: 'afsona-dev-api',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      loadEnvFile()

      server.middlewares.use('/api', (async (
        req: IncomingMessage,
        res: ServerResponse,
        next: Connect.NextFunction,
      ) => {
        // "/api/admin?x=1" → "admin"
        const path = (req.url || '/').split('?')[0].replace(/^\/+|\/+$/g, '')
        if (!path || path.includes('..')) return next()

        try {
          const module = await server.ssrLoadModule(`/api/${path}.ts`)
          const handler = module.default
          if (typeof handler !== 'function') return next()

          await handler(await asVercelRequest(req), asVercelResponse(res))
        } catch (error) {
          // Modul topilmasa — oddiy 404, boshqa xatolarni ko'rsatamiz
          const message = error instanceof Error ? error.message : String(error)
          if (message.includes('Failed to load url')) return next()

          server.config.logger.error(`[dev-api] /api/${path}: ${message}`)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
          }
          res.end(JSON.stringify({ error: message }))
        }
      }) as Connect.NextHandleFunction)
    },
  }
}

/** `.env` ni process.env ga yuklaydi (dotenv'siz, oddiy format yetarli). */
function loadEnvFile() {
  let raw: string
  try {
    raw = readFileSync('.env', 'utf8')
  } catch {
    return
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equals = trimmed.indexOf('=')
    if (equals < 1) continue

    const key = trimmed.slice(0, equals).trim()
    let value = trimmed.slice(equals + 1).trim()
    // Qo'shtirnoq ichidagi qiymatlardan qobiqni olib tashlaymiz
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    // Allaqachon berilgan qiymatni bosib ketmaymiz
    if (process.env[key] === undefined) process.env[key] = value
  }
}

/** Vercel handler `req.body` ni tayyor obyekt deb kutadi. */
async function asVercelRequest(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')

  let body: unknown = raw
  if (raw && (req.headers['content-type'] || '').includes('application/json')) {
    try {
      body = JSON.parse(raw)
    } catch {
      body = raw
    }
  }

  const url = new URL(req.url || '/', 'http://localhost')
  const query: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })

  return Object.assign(req, { body, query, cookies: {} })
}

/** Vercel handler `res.status(200).json(...)` zanjirini kutadi. */
function asVercelResponse(res: ServerResponse) {
  const wrapped = res as ServerResponse & {
    status: (code: number) => typeof wrapped
    json: (data: unknown) => typeof wrapped
    send: (data: unknown) => typeof wrapped
  }

  wrapped.status = (code: number) => {
    res.statusCode = code
    return wrapped
  }

  wrapped.json = (data: unknown) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(data))
    return wrapped
  }

  wrapped.send = (data: unknown) => {
    if (typeof data === 'object' && data !== null) return wrapped.json(data)
    res.end(String(data ?? ''))
    return wrapped
  }

  return wrapped
}
