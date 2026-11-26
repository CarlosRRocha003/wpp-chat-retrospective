/**
 * Cofre das retrospectivas compartilhadas.
 *
 * Guarda pacotes que já chegam criptografados pelo navegador (AES-GCM). A chave fica só
 * no link, depois do "#", e nunca é enviada para cá: este servidor não consegue ler nada.
 * Cada pacote expira sozinho.
 */

export interface Env {
  RETROS: KVNamespace
  LIMITE: RateLimit
  ALLOWED_ORIGINS: string
}

const TTL_SECONDS = 60 * 60 * 24 * 90 // 90 dias
const MAX_BYTES = 10 * 1024 * 1024 // o KV aceita até 25 MiB; 10 MB sobra para figurinhas e áudios
const MIN_BYTES = 12 + 16 // vetor de inicialização + etiqueta do AES-GCM

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const origin = req.headers.get('Origin') ?? ''
    const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    const fromSite = allowed.includes(origin)
    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': fromSite ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    }

    if (req.method === 'OPTIONS') return new Response(null, { headers })

    if (req.method === 'POST' && url.pathname === '/r') {
      // Só o site da retrospectiva pode guardar pacotes
      if (!fromSite) return new Response('Origem não permitida', { status: 403, headers })
      // Poucos links por minuto por endereço de internet: ninguém precisa de mais que isso,
      // e impede que alguém use o cofre como depósito de arquivos
      const ip = req.headers.get('CF-Connecting-IP') ?? 'local'
      const { success } = await env.LIMITE.limit({ key: ip })
      if (!success) return new Response('Muitos links em pouco tempo', { status: 429, headers: { ...headers, 'Retry-After': '60' } })
      if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BYTES) return new Response('Pacote grande demais', { status: 413, headers })
      const body = await req.arrayBuffer()
      if (body.byteLength > MAX_BYTES) return new Response('Pacote grande demais', { status: 413, headers })
      if (body.byteLength < MIN_BYTES) return new Response('Pacote inválido', { status: 400, headers })
      const id = randomId()
      await env.RETROS.put(id, body, { expirationTtl: TTL_SECONDS })
      return Response.json({ id, expiresAt: Date.now() + TTL_SECONDS * 1000 }, { headers })
    }

    const m = /^\/r\/([A-Za-z0-9_-]{16,32})$/.exec(url.pathname)
    if (req.method === 'GET' && m) {
      const value = await env.RETROS.get(m[1], 'arrayBuffer')
      if (!value) return new Response('Não encontrado ou expirado', { status: 404, headers })
      return new Response(value, {
        headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=86400, immutable' },
      })
    }

    return new Response('Não encontrado', { status: 404, headers })
  },
}
