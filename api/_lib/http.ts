import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Mini app va API bir domenda — CORS ochilmaydi, faqat metod tekshiriladi. */
export function requirePost(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Faqat POST' })
    return false
  }
  return true
}

export function fail(res: VercelResponse, status: number, message: string) {
  res.status(status).json({ error: message })
}
