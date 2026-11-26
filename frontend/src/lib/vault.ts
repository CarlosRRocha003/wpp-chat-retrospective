/**
 * Cofre: guarda a retrospectiva compartilhada já criptografada, para o link ficar curto
 * e poder levar figurinhas animadas, fotos e áudios.
 *
 * A chave (AES-GCM de 256 bits) é sorteada aqui no navegador e vai só no link, depois do
 * "#" — essa parte da URL nunca é enviada ao servidor. O cofre recebe e devolve bytes que
 * não consegue ler.
 */
import type { Retro } from './stats'

// Endereço do cofre (worker/ no repositório), definido no build por VITE_VAULT_URL
// (.env.development aponta para o cofre local; .env.production para o publicado).
// Sem ele, o site gera só o link simples.
export const VAULT_URL: string | undefined = import.meta.env.VITE_VAULT_URL

const IV_BYTES = 12
// Igual ao limite do cofre (worker/src/index.ts)
export const VAULT_MAX_BYTES = 10 * 1024 * 1024

/** Recusa do cofre com uma explicação que dá para mostrar a quem está gerando o link. */
export class VaultRefused extends Error {}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Comprime e criptografa. Devolve o pacote (vetor de inicialização + dados) e a chave. */
export async function seal(r: Retro): Promise<{ packet: Uint8Array; key: Uint8Array }> {
  const plain = await pipe(new TextEncoder().encode(JSON.stringify(r)), new CompressionStream('deflate-raw'))
  const key = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, cryptoKey, plain as BufferSource))
  const packet = new Uint8Array(IV_BYTES + cipher.length)
  packet.set(iv)
  packet.set(cipher, IV_BYTES)
  return { packet, key }
}

export async function unseal(packet: Uint8Array, key: Uint8Array): Promise<Retro> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, ['decrypt'])
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: packet.subarray(0, IV_BYTES) as BufferSource },
    cryptoKey,
    packet.subarray(IV_BYTES) as BufferSource,
  )
  const json = await pipe(new Uint8Array(plain), new DecompressionStream('deflate-raw'))
  const r = JSON.parse(new TextDecoder().decode(json)) as Retro
  if (r.v !== 1 || !Array.isArray(r.people)) throw new Error('Pacote inválido')
  return r
}

/** Criptografa, guarda no cofre e devolve o link curto. */
export async function uploadToVault(r: Retro): Promise<{ url: string; expiresAt: number; bytes: number }> {
  if (!VAULT_URL) throw new VaultRefused('O cofre ainda não está configurado neste site.')
  const { packet, key } = await seal(r)
  if (packet.length > VAULT_MAX_BYTES) {
    const mb = (packet.length / 1024 / 1024).toFixed(1).replace('.', ',')
    throw new VaultRefused(`A retrospectiva ficou com ${mb} MB, e o cofre aceita até 10 MB. Tente desmarcar os trechos de conversa ou as fotos.`)
  }
  const res = await fetch(`${VAULT_URL}/r`, { method: 'POST', body: packet as BodyInit, headers: { 'Content-Type': 'application/octet-stream' } })
  if (res.status === 429) throw new VaultRefused('Foram gerados muitos links em pouco tempo. Espere um minuto e gere de novo.')
  if (res.status === 413) throw new VaultRefused('A retrospectiva ficou grande demais para o cofre. Tente desmarcar os trechos de conversa ou as fotos.')
  if (!res.ok) throw new Error(`O cofre recusou o pacote (${res.status})`)
  const { id, expiresAt } = (await res.json()) as { id: string; expiresAt: number }
  const base = location.href.split('#')[0]
  return { url: `${base}#c=${id}.${toBase64Url(key)}`, expiresAt, bytes: packet.length }
}

export function vaultLinkFromHash(hash: string): { id: string; key: Uint8Array } | null {
  const m = /^#c=([A-Za-z0-9_-]{16,32})\.([A-Za-z0-9_-]{40,})$/.exec(hash)
  return m ? { id: m[1], key: fromBase64Url(m[2]) } : null
}

export class VaultNotFound extends Error {}

export async function openFromVault(id: string, key: Uint8Array): Promise<Retro> {
  const res = await fetch(`${VAULT_URL}/r/${id}`)
  if (res.status === 404) throw new VaultNotFound('Esse link expirou ou não existe mais.')
  if (!res.ok) throw new Error(`Não consegui abrir o cofre (${res.status})`)
  return unseal(new Uint8Array(await res.arrayBuffer()), key)
}
