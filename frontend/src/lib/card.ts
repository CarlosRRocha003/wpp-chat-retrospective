import type { Retro } from './stats'
import { awardInfo } from './awards'
import { LAUGH_LABEL, type LaughType } from './text'
import { dateLong, firstName, num } from './format'

export const CARD_COLORS = ['#d6f84a', '#48d4f2', '#ff93d3', '#ffc93c', '#4be6ab', '#ff6b57']
const INK = '#16121f'
const CREAM = '#fff5e4'
const DISPLAY = '"Bricolage Grotesque", "Arial Black", sans-serif'
const BODY = 'Figtree, system-ui, sans-serif'

export interface Fact {
  label: string
  value: string
}

export function personFacts(r: Retro, i: number): Fact[] {
  const p = r.people[i]
  const facts: Fact[] = [
    { label: `mensagens · ${i + 1}º do grupo`, value: num(p.messages) },
    { label: 'palavras', value: num(p.words) },
  ]
  if (p.topEmojis[0]) facts.push({ label: 'emoji favorito', value: p.topEmojis[0][0] })
  const peak = p.hours.indexOf(Math.max(...p.hours))
  if (p.messages > 0) facts.push({ label: 'horário favorito', value: `${peak}h` })
  const laugh = (Object.entries(p.laughTypes) as [LaughType, number][]).sort((a, b) => b[1] - a[1])[0]
  if (laugh) facts.push({ label: 'jeito de rir', value: LAUGH_LABEL[laugh[0]] })
  if (p.partner >= 0) facts.push({ label: 'mais conversa com', value: firstName(r.people[p.partner].name) })
  if (p.catchphrases?.[0]) facts.push({ label: 'bordão', value: p.catchphrases[0] })
  if (r.mediaTyped && p.media.audio > 0) facts.push({ label: 'áudios', value: num(p.media.audio) })
  if (r.mediaTyped && p.media.sticker > 0) facts.push({ label: 'figurinhas', value: num(p.media.sticker) })
  return facts.slice(0, 6)
}

export async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`800 100px ${DISPLAY}`),
      document.fonts.load(`600 40px ${BODY}`),
      document.fonts.load(`800 40px ${BODY}`),
    ])
  } catch {
    // Sem as fontes, o canvas usa as do sistema
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, weight: number, start: number, maxWidth: number, maxLines: number): number {
  let size = start
  for (; size > 30; size -= 4) {
    ctx.font = `${weight} ${size}px ${family}`
    if (wrap(ctx, text, maxWidth).length <= maxLines) break
  }
  return size
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function newCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = 1080
  c.height = 1920
  return [c, c.getContext('2d')!]
}

function footer(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color
  ctx.globalAlpha = 0.75
  ctx.font = `700 34px ${BODY}`
  ctx.textAlign = 'center'
  ctx.fillText('Retrospectiva do Grupo', 540, 1850)
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
}

function periodText(r: Retro) {
  return /^\d{4}$/.test(r.period.label) ? r.period.label : 'desde o começo'
}

export async function drawPersonCard(r: Retro, i: number): Promise<HTMLCanvasElement> {
  await ensureFonts()
  const [canvas, ctx] = newCanvas()
  const bg = CARD_COLORS[i % CARD_COLORS.length]
  const award = r.awards.find((a) => a.person === i)
  const info = award ? awardInfo(award, r) : { title: 'Presença garantida', emoji: '🙌', description: '' }

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1080, 1920)
  // Formas
  ctx.fillStyle = INK
  ctx.globalAlpha = 0.08
  ctx.beginPath()
  ctx.arc(980, 260, 300, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = CARD_COLORS[(i + 2) % CARD_COLORS.length]
  roundRect(ctx, -70, 1760, 230, 230, 50)
  ctx.fill()

  const X = 90
  const W = 900
  ctx.fillStyle = INK
  ctx.font = `800 36px ${BODY}`
  ctx.fillText(`${r.group} · ${periodText(r)}`.toUpperCase().slice(0, 48), X, 150)

  ctx.font = `160px ${BODY}`
  ctx.fillText(info.emoji, X - 6, 380)

  const titleSize = fitFont(ctx, info.title, DISPLAY, 800, 132, W, 2)
  ctx.font = `800 ${titleSize}px ${DISPLAY}`
  let y = 420 + titleSize
  for (const line of wrap(ctx, info.title, W)) {
    ctx.fillText(line, X, y)
    y += titleSize * 0.95
  }

  y += 20
  ctx.font = `600 44px ${BODY}`
  for (const line of wrap(ctx, info.description, W).slice(0, 3)) {
    ctx.fillText(line, X, y)
    y += 58
  }

  y += 40
  const nameSize = fitFont(ctx, r.people[i].name, DISPLAY, 800, 76, W, 1)
  ctx.font = `800 ${nameSize}px ${DISPLAY}`
  ctx.fillText(r.people[i].name, X, y + nameSize * 0.6)
  y += nameSize + 50

  const facts = personFacts(r, i)
  const colW = (W - 24) / 2
  const rowH = 190
  facts.forEach((f, k) => {
    const fx = X + (k % 2) * (colW + 24)
    const fy = y + Math.floor(k / 2) * (rowH + 24)
    ctx.fillStyle = 'rgba(22,18,31,0.1)'
    roundRect(ctx, fx, fy, colW, rowH, 36)
    ctx.fill()
    ctx.fillStyle = INK
    if (/\p{Extended_Pictographic}/u.test(f.value)) ctx.font = `76px ${BODY}`
    else ctx.font = `800 ${fitFont(ctx, f.value, DISPLAY, 800, 72, colW - 64, 1)}px ${DISPLAY}`
    ctx.fillText(f.value, fx + 32, fy + 100)
    ctx.font = `600 32px ${BODY}`
    ctx.globalAlpha = 0.8
    ctx.fillText(f.label, fx + 32, fy + 150)
    ctx.globalAlpha = 1
  })

  if (r.people[i].photo) {
    try {
      const img = new Image()
      img.src = r.people[i].photo!
      await img.decode()
      ctx.save()
      ctx.beginPath()
      ctx.arc(860, 300, 130, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, 730, 170, 260, 260)
      ctx.restore()
      ctx.strokeStyle = INK
      ctx.lineWidth = 10
      ctx.beginPath()
      ctx.arc(860, 300, 130, 0, Math.PI * 2)
      ctx.stroke()
    } catch {
      // foto inválida: segue sem ela
    }
  }

  footer(ctx, INK)
  return canvas
}

export async function drawSummaryCard(r: Retro): Promise<HTMLCanvasElement> {
  await ensureFonts()
  const [canvas, ctx] = newCanvas()
  ctx.fillStyle = '#1d1836'
  ctx.fillRect(0, 0, 1080, 1920)
  ctx.fillStyle = CARD_COLORS[0]
  ctx.beginPath()
  ctx.arc(1000, 120, 220, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = CARD_COLORS[2]
  ctx.lineWidth = 40
  ctx.beginPath()
  ctx.arc(-20, 1960, 150, 0, Math.PI * 2)
  ctx.stroke()

  const X = 90
  const W = 900
  ctx.fillStyle = CREAM
  ctx.font = `800 36px ${BODY}`
  ctx.fillText(`RETROSPECTIVA ${periodText(r).toUpperCase()}`, X, 170)

  ctx.fillStyle = CARD_COLORS[0]
  const gs = fitFont(ctx, r.group, DISPLAY, 800, 120, W - 80, 2)
  ctx.font = `800 ${gs}px ${DISPLAY}`
  let y = 200 + gs
  for (const line of wrap(ctx, r.group, W - 80).slice(0, 2)) {
    ctx.fillText(line, X, y)
    y += gs * 0.95
  }

  y += 50
  ctx.fillStyle = CREAM
  ctx.font = `800 150px ${DISPLAY}`
  ctx.fillText(num(r.totals.messages), X, y + 110)
  ctx.font = `600 44px ${BODY}`
  ctx.fillText(`mensagens entre ${r.people.length} pessoas`, X, y + 180)
  y += 260

  ctx.font = `800 34px ${BODY}`
  ctx.globalAlpha = 0.7
  ctx.fillText('QUEM MAIS FALOU', X, y)
  ctx.globalAlpha = 1
  y += 30
  const top = r.people.slice(0, 3)
  const max = Math.max(top[0]?.messages ?? 1, 1)
  top.forEach((p, k) => {
    ctx.font = `800 46px ${DISPLAY}`
    ctx.fillStyle = CREAM
    ctx.fillText(`${k + 1}. ${p.name}`.slice(0, 30), X, y + 52)
    ctx.textAlign = 'right'
    ctx.font = `700 40px ${BODY}`
    ctx.fillText(num(p.messages), X + W, y + 52)
    ctx.textAlign = 'left'
    ctx.fillStyle = CARD_COLORS[k]
    roundRect(ctx, X, y + 72, Math.max(20, (p.messages / max) * W), 16, 8)
    ctx.fill()
    y += 112
  })

  y += 30
  const day = r.topDays[0]
  if (day) {
    ctx.fillStyle = CREAM
    ctx.font = `600 40px ${BODY}`
    ctx.fillText(`Dia mais agitado: ${dateLong(day.ts)} (${num(day.count)} msgs)`, X, y)
    y += 64
  }
  if (r.topEmojis.length) {
    ctx.font = `600 40px ${BODY}`
    ctx.fillText('Emojis do ano:', X, y)
    ctx.font = `64px ${BODY}`
    ctx.fillText(r.topEmojis.slice(0, 5).map(([e]) => e).join(' '), X + 300, y + 8)
    y += 90
  }

  y += 20
  ctx.font = `800 34px ${BODY}`
  ctx.globalAlpha = 0.7
  ctx.fillText('PRÊMIOS', X, y)
  ctx.globalAlpha = 1
  y += 24
  // Quantas linhas de prêmios cabem antes do rodapé
  const rows = Math.max(1, Math.min(3, Math.floor((1790 - y) / 150)))
  const awards = r.awards.slice(0, rows * 2)
  const colW = (W - 24) / 2
  awards.forEach((a, k) => {
    const info = awardInfo(a, r)
    const ax = X + (k % 2) * (colW + 24)
    const ay = y + Math.floor(k / 2) * 150
    ctx.fillStyle = 'rgba(255,245,228,0.1)'
    roundRect(ctx, ax, ay, colW, 130, 30)
    ctx.fill()
    ctx.fillStyle = CREAM
    ctx.font = `56px ${BODY}`
    ctx.fillText(info.emoji, ax + 24, ay + 86)
    const ts = fitFont(ctx, info.title, DISPLAY, 800, 36, colW - 130, 1)
    ctx.font = `800 ${ts}px ${DISPLAY}`
    ctx.fillText(info.title, ax + 110, ay + 58)
    ctx.font = `600 32px ${BODY}`
    ctx.fillText(firstName(r.people[a.person].name).slice(0, 18), ax + 110, ay + 100)
  })

  footer(ctx, CREAM)
  return canvas
}

export async function shareCanvas(canvas: HTMLCanvasElement, fileName: string): Promise<'shared' | 'downloaded'> {
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar a imagem'))), 'image/png'))
  const file = new File([blob], fileName, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}
