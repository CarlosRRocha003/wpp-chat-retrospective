/**
 * Leitor mínimo de .zip que extrai só o .txt da conversa.
 * Lê pedaços do arquivo com Blob.slice, então um export com GBs de mídia
 * não precisa caber na memória do celular.
 */

interface Entry {
  name: string
  method: number
  compressedSize: number
  localOffset: number
}

const u16 = (v: DataView, o: number) => v.getUint16(o, true)
const u32 = (v: DataView, o: number) => v.getUint32(o, true)
const u64 = (v: DataView, o: number) => Number(v.getBigUint64(o, true))

async function view(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer())
}

async function readCentralDirectory(file: Blob): Promise<Entry[]> {
  const tailSize = Math.min(file.size, 65557)
  const tailStart = file.size - tailSize
  const tail = await view(file, tailStart, file.size)

  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (u32(tail, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Esse arquivo não parece ser um .zip válido.')

  let count = u16(tail, eocd + 10)
  let cdSize = u32(tail, eocd + 12)
  let cdOffset = u32(tail, eocd + 16)

  // ZIP64
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff || count === 0xffff) {
    const loc = eocd - 20
    if (loc >= 0 && u32(tail, loc) === 0x07064b50) {
      const z64Offset = u64(tail, loc + 8)
      const z64 = await view(file, z64Offset, z64Offset + 56)
      count = u64(z64, 32)
      cdSize = u64(z64, 40)
      cdOffset = u64(z64, 48)
    }
  }

  const cd = await view(file, cdOffset, cdOffset + cdSize)
  const decoder = new TextDecoder()
  const entries: Entry[] = []
  let p = 0
  for (let i = 0; i < count && p + 46 <= cd.byteLength; i++) {
    if (u32(cd, p) !== 0x02014b50) break
    const method = u16(cd, p + 10)
    let compressedSize = u32(cd, p + 20)
    let uncompressedSize = u32(cd, p + 24)
    const nameLen = u16(cd, p + 28)
    const extraLen = u16(cd, p + 30)
    const commentLen = u16(cd, p + 32)
    let localOffset = u32(cd, p + 42)
    const name = decoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen))

    // Campo extra ZIP64 com tamanhos/offset de 64 bits
    let e = p + 46 + nameLen
    const extraEnd = e + extraLen
    while (e + 4 <= extraEnd) {
      const id = u16(cd, e)
      const size = u16(cd, e + 2)
      if (id === 0x0001) {
        let q = e + 4
        if (uncompressedSize === 0xffffffff) {
          uncompressedSize = u64(cd, q)
          q += 8
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = u64(cd, q)
          q += 8
        }
        if (localOffset === 0xffffffff) localOffset = u64(cd, q)
      }
      e += 4 + size
    }

    entries.push({ name, method, compressedSize, localOffset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function pickChatEntry(entries: Entry[]): Entry | undefined {
  const txts = entries.filter((e) => /\.txt$/i.test(e.name) && !e.name.startsWith('__MACOSX'))
  return (
    txts.find((e) => /(^|\/)_chat\.txt$/i.test(e.name)) ??
    txts.find((e) => /whatsapp/i.test(e.name)) ??
    txts.sort((a, b) => b.compressedSize - a.compressedSize)[0]
  )
}

async function readEntry(file: Blob, entry: Entry): Promise<Blob> {
  const local = await view(file, entry.localOffset, entry.localOffset + 30)
  if (u32(local, 0) !== 0x04034b50) throw new Error('O .zip parece estar corrompido.')
  const dataStart = entry.localOffset + 30 + u16(local, 26) + u16(local, 28)
  const data = file.slice(dataStart, dataStart + entry.compressedSize)
  if (entry.method === 0) return data
  if (entry.method !== 8) throw new Error('Esse .zip usa uma compressão que eu não sei abrir.')
  const stream = data.stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return await new Response(stream).blob()
}

export async function extractChatFromZip(file: Blob): Promise<string> {
  const entries = await readCentralDirectory(file)
  const entry = pickChatEntry(entries)
  if (!entry) throw new Error('Não encontrei o .txt da conversa dentro do .zip.')
  return await (await readEntry(file, entry)).text()
}

export interface ChatSource {
  text: string
  /** Só existe para exports "com mídia": abre um anexo (figurinha, foto) pelo nome do arquivo */
  media?: (name: string) => Promise<Blob | null>
}

export async function readChatFile(file: File): Promise<ChatSource> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
  if (!isZip && !/\.zip$/i.test(file.name)) return { text: await file.text() }

  const entries = await readCentralDirectory(file)
  const chat = pickChatEntry(entries)
  if (!chat) throw new Error('Não encontrei o .txt da conversa dentro do .zip.')
  const text = await (await readEntry(file, chat)).text()
  const byName = new Map(entries.map((e) => [e.name.split('/').pop()!, e]))
  const hasMedia = entries.length > 1
  return {
    text,
    media: hasMedia
      ? async (name) => {
          const entry = byName.get(name)
          return entry ? await readEntry(file, entry) : null
        }
      : undefined,
  }
}
