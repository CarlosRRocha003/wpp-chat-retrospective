import type { Retro } from './stats'

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encodeRetro(r: Retro): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(r))
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))
}

export async function decodeRetro(payload: string): Promise<Retro> {
  const bytes = await pipe(fromBase64Url(payload), new DecompressionStream('deflate-raw'))
  const r = JSON.parse(new TextDecoder().decode(bytes)) as Retro
  if (r.v !== 1 || !Array.isArray(r.people)) throw new Error('Link inválido')
  return r
}

export async function shareUrl(r: Retro): Promise<string> {
  const base = location.href.split('#')[0]
  return `${base}#r=${await encodeRetro(r)}`
}

export function payloadFromHash(hash: string): string | null {
  const m = /^#r=([A-Za-z0-9_-]+)$/.exec(hash)
  return m ? m[1] : null
}
