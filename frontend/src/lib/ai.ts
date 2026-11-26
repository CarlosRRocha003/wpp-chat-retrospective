import type { Message } from './parser'
import type { Retro } from './stats'
import { pickTopic } from './topics'
import type { TopicMessage, TopicRequest } from './topics.worker'

const CHUNK = 30 // mensagens por pedaço; o modelo lê uns 512 tokens por vez
const MAX_CHUNKS_PER_DAY = 10
const BASE_CHUNKS = 24

function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function chunks(texts: string[], max: number): string[] {
  const all: string[] = []
  for (let i = 0; i < texts.length; i += CHUNK) all.push(texts.slice(i, i + CHUNK).join('. '))
  if (all.length <= max) return all
  // Dia muito longo: pega pedaços espalhados pelo dia todo
  return Array.from({ length: max }, (_, k) => all[Math.floor((k * all.length) / max)])
}

export interface AiProgress {
  stage: 'download' | 'working'
  /** 0 a 1 durante o download */
  fraction?: number
}

/**
 * Descobre o tema dos dias mais agitados e dos maiores textões, direto no navegador.
 * Preenche `topic` no próprio objeto; quando nada se destaca, deixa vazio.
 */
export function findTopics(all: Message[], retro: Retro, onProgress: (p: AiProgress) => void): Promise<void> {
  const inPeriod = all.filter((m) => m.author !== null && m.kind === 'text' && m.ts >= retro.period.start && m.ts <= retro.period.end)
  const groups: string[][] = []

  const topKeys = new Set(retro.topDays.map((d) => dayKey(d.ts)))
  for (const d of retro.topDays) {
    const key = dayKey(d.ts)
    groups.push(chunks(inPeriod.filter((m) => dayKey(m.ts) === key).map((m) => m.text), MAX_CHUNKS_PER_DAY))
  }
  for (const t of retro.longTexts) {
    const name = retro.people[t.person]?.name
    const msg = inPeriod.find((m) => m.ts === t.ts && m.author === name)
    groups.push(msg ? [msg.text] : [''])
  }

  // A conversa de sempre: pedaços espalhados pelo período, fora dos dias agitados
  const usual = inPeriod.filter((m) => !topKeys.has(dayKey(m.ts)))
  const base: string[] = []
  const step = Math.max(CHUNK, Math.floor(usual.length / BASE_CHUNKS))
  for (let i = 0; i + 5 < usual.length && base.length < BASE_CHUNKS; i += step) {
    base.push(usual.slice(i, i + CHUNK).map((m) => m.text).join('. '))
  }
  if (base.length === 0 || groups.length === 0) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./topics.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<TopicMessage>) => {
      const m = e.data
      if (m.type === 'progress') onProgress({ stage: 'download', fraction: m.total ? m.loaded / m.total : 0 })
      else if (m.type === 'working') onProgress({ stage: 'working' })
      else if (m.type === 'error') {
        worker.terminate()
        reject(new Error(m.message))
      } else {
        retro.topDays.forEach((d, i) => {
          const topic = pickTopic(m.scores[i], m.base, { text: groups[i].join(' '), min: 3 })
          if (topic) d.topic = topic
        })
        retro.longTexts.forEach((t, i) => {
          const k = retro.topDays.length + i
          const topic = pickTopic(m.scores[k], m.base, { text: groups[k].join(' '), min: 1 })
          if (topic) t.topic = topic
        })
        worker.terminate()
        resolve()
      }
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'Falha ao rodar a IA'))
    }
    worker.postMessage({ groups, base } satisfies TopicRequest)
  })
}
