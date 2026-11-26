/** Recorta a imagem em quadrado no centro e reduz, devolvendo um data URL. */
export async function squarePhoto(source: Blob | string, size: number, quality = 0.82): Promise<string> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
    const webp = canvas.toDataURL('image/webp', quality)
    // Safari antigo não gera webp e devolve png; nesse caso usa jpeg
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality)
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url)
  }
}

export function initials(name: string): string {
  if (/^[+\d]/.test(name)) return name.replace(/\D/g, '').slice(-2)
  const parts = name.split(/\s+/).filter((p) => /\p{L}/u.test(p))
  if (parts.length === 0) return name.slice(0, 2).toUpperCase()
  const first = [...parts[0]][0] ?? ''
  const last = parts.length > 1 ? ([...parts[parts.length - 1]][0] ?? '') : ''
  return (first + last).toUpperCase()
}

/** Miniatura que mantém a proporção; webp preserva a transparência das figurinhas. */
export async function thumbnail(source: Blob | string, max: number, quality = 0.8): Promise<string> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio))
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const webp = canvas.toDataURL('image/webp', quality)
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url)
  }
}

/** Lê um endereço local (blob:) e devolve o arquivo inteiro como data URL, para ir no cofre. */
export async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src
  const blob = await (await fetch(src)).blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
