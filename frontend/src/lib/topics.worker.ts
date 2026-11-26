// Roda o modelo de similaridade fora da tela principal, para a página não travar.
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { THEMES, themePassage } from './topics'

export interface TopicRequest {
  /** Cada grupo é um assunto a classificar (um dia, um textão), em um ou mais pedaços */
  groups: string[][]
  /** Pedaços da conversa de sempre, para comparar */
  base: string[]
}

export type TopicMessage =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'working' }
  | { type: 'done'; scores: number[][]; base: number[] }
  | { type: 'error'; message: string }

const MODEL = 'Xenova/multilingual-e5-small'
let extractor: Promise<FeatureExtractionPipeline> | null = null

function load(post: (m: TopicMessage) => void) {
  const files = new Map<string, { loaded: number; total: number }>()
  extractor ??= pipeline('feature-extraction', MODEL, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== 'progress' || !p.file) return
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 })
      let loaded = 0
      let total = 0
      for (const f of files.values()) {
        loaded += f.loaded
        total += f.total
      }
      post({ type: 'progress', loaded, total })
    },
  }) as Promise<FeatureExtractionPipeline>
  return extractor
}

async function embed(model: FeatureExtractionPipeline, texts: string[]): Promise<number[][]> {
  const out: number[][] = []
  // Aos poucos, para não estourar a memória do celular
  for (let i = 0; i < texts.length; i += 4) {
    const t = await model(texts.slice(i, i + 4), { pooling: 'mean', normalize: true })
    out.push(...(t.tolist() as number[][]))
  }
  return out
}

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)

function meanVector(vectors: number[][]): number[] {
  const v = vectors[0].map((_, i) => vectors.reduce((s, x) => s + x[i], 0) / vectors.length)
  const n = Math.sqrt(dot(v, v)) || 1
  return v.map((x) => x / n)
}

self.onmessage = async (e: MessageEvent<TopicRequest>) => {
  const post = (m: TopicMessage) => self.postMessage(m)
  try {
    const model = await load(post)
    post({ type: 'working' })
    const themes = await embed(model, THEMES.map(themePassage))
    const score = (v: number[]) => themes.map((t) => dot(t, v))

    const scores: number[][] = []
    for (const chunks of e.data.groups) {
      const vecs = await embed(model, chunks.map((c) => `query: ${c}`))
      scores.push(score(meanVector(vecs)))
    }
    const baseVecs = await embed(model, e.data.base.map((c) => `query: ${c}`))
    const baseScores = baseVecs.map(score)
    const base = THEMES.map((_, i) => baseScores.reduce((s, b) => s + b[i], 0) / baseScores.length)
    post({ type: 'done', scores, base })
  } catch (err) {
    post({ type: 'error', message: (err as Error).message })
  }
}
