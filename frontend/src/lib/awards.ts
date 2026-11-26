import type { PersonStats, Retro } from './stats'

export interface Award {
  id: string
  person: number
  value: number
}

interface AwardDef {
  id: string
  title: string
  emoji: string
  /** Valor da pessoa nessa categoria; maior é melhor. */
  metric: (p: PersonStats, r: Retro) => number
  /** Valor mínimo para a categoria valer alguma coisa. */
  min: number
  describe: (value: number, p: PersonStats, r: Retro) => string
}

const fmt = (n: number) => n.toLocaleString('pt-BR')
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

export const AWARDS: AwardDef[] = [
  {
    id: 'alma',
    title: 'Alma do grupo',
    emoji: '💬',
    metric: (p) => p.messages,
    min: 1,
    describe: (v, _p, r) => `${fmt(v)} mensagens, ${pct(v, r.totals.messages)}% de tudo que foi dito`,
  },
  {
    id: 'podcast',
    title: 'Podcaster',
    emoji: '🎙️',
    metric: (p) => p.media.audio,
    min: 5,
    describe: (v) => `${fmt(v)} áudios mandados. Tem gente que escuta em 2x por sua causa`,
  },
  {
    id: 'figurinha',
    title: 'Fábrica de figurinhas',
    emoji: '🃏',
    metric: (p) => p.media.sticker,
    min: 5,
    describe: (v) => `${fmt(v)} figurinhas. Responde tudo sem digitar uma palavra`,
  },
  {
    id: 'paparazzi',
    title: 'Paparazzi',
    emoji: '📸',
    metric: (p) => p.media.image + p.media.video + p.media.gif,
    min: 5,
    describe: (v) => `${fmt(v)} fotos, vídeos e gifs. Nada passa sem registro`,
  },
  {
    id: 'coruja',
    title: 'Coruja',
    emoji: '🦉',
    metric: (p) => p.night,
    min: 10,
    describe: (v) => `${fmt(v)} mensagens entre meia-noite e 5 da manhã`,
  },
  {
    id: 'despertador',
    title: 'Despertador',
    emoji: '⏰',
    metric: (p) => p.dayOpeners,
    min: 5,
    describe: (v) => `Puxou o primeiro assunto do dia ${fmt(v)} vezes`,
  },
  {
    id: 'plateia',
    title: 'Plateia',
    emoji: '🤣',
    metric: (p) => p.laughs,
    min: 10,
    describe: (v) => `${fmt(v)} risadas. Ri até da piada ruim`,
  },
  {
    id: 'textao',
    title: 'Mestre do textão',
    emoji: '📜',
    metric: (p) => (p.textMessages >= 30 ? p.words / p.textMessages : 0),
    min: 6,
    describe: (v) => `Média de ${v.toFixed(1).replace('.', ',')} palavras por mensagem`,
  },
  {
    id: 'telegrama',
    title: 'Modo telegrama',
    emoji: '📟',
    metric: (p) => (p.textMessages >= 50 ? p.shortMessages / p.textMessages : 0),
    min: 0.45,
    describe: (v) => `${Math.round(v * 100)}% das mensagens com no máximo duas palavras`,
  },
  {
    id: 'curioso',
    title: 'Curiosidade em pessoa',
    emoji: '❓',
    metric: (p) => p.questions,
    min: 10,
    describe: (v) => `${fmt(v)} perguntas feitas ao grupo`,
  },
  {
    id: 'desfibrilador',
    title: 'Desfibrilador',
    emoji: '⚡',
    metric: (p) => p.revives,
    min: 3,
    describe: (v, _p, r) => `Ressuscitou o grupo ${fmt(v)} vezes depois de ${silenceLabel(r.reviveThresholdH)} de silêncio`,
  },
  {
    id: 'curadoria',
    title: 'Curadoria',
    emoji: '🔗',
    metric: (p) => p.links,
    min: 5,
    describe: (v) => `${fmt(v)} links compartilhados`,
  },
  {
    id: 'capslock',
    title: 'CAPS LOCK',
    emoji: '📢',
    metric: (p) => p.caps,
    min: 5,
    describe: (v) => `${fmt(v)} MENSAGENS GRITADAS`,
  },
  {
    id: 'borracha',
    title: 'Borracha',
    emoji: '🫣',
    metric: (p) => p.deleted,
    min: 3,
    describe: (v) => `Apagou ${fmt(v)} mensagens. O que será que tinha ali?`,
  },
  {
    id: 'revisor',
    title: 'Revisão de texto',
    emoji: '✏️',
    metric: (p) => p.edited,
    min: 3,
    describe: (v) => `Editou ${fmt(v)} mensagens depois de mandar`,
  },
  {
    id: 'gatilho',
    title: 'Gatilho mais rápido',
    emoji: '🏎️',
    metric: (p) => (p.replyMedianSec ? 1 / p.replyMedianSec : 0),
    min: 0,
    describe: (_v, p) => `Responde em ${durationLabel((p.replyMedianSec ?? 0) * 1000)}, na mediana`,
  },
  {
    id: 'emojiteca',
    title: 'Emojiteca',
    emoji: '🫶',
    metric: (p) => p.emojiCount,
    min: 15,
    describe: (v, p) => `${fmt(v)} emojis, com destaque pro ${p.topEmojis[0]?.[0] ?? ''}`,
  },
  {
    id: 'vento',
    title: 'Pergunta pro vento',
    emoji: '🍃',
    metric: (p) => p.unanswered,
    min: 3,
    describe: (v) => `${fmt(v)} perguntas que ficaram mais de uma hora sem resposta`,
  },
  {
    id: 'monologo',
    title: 'Monólogo',
    emoji: '🎭',
    metric: (p) => p.longestRun,
    min: 10,
    describe: (v) => `Mandou ${fmt(v)} mensagens seguidas sem ninguém interromper`,
  },
  {
    id: 'democracia',
    title: 'Democracia',
    emoji: '🗳️',
    metric: (p) => p.polls,
    min: 2,
    describe: (v) => `Criou ${fmt(v)} enquetes. Tudo vai a votação`,
  },
]

export const FALLBACK_AWARDS: Record<string, { title: string; emoji: string; describe: (p: PersonStats) => string }> = {
  fantasma: {
    title: 'Modo fantasma',
    emoji: '👻',
    describe: (p) => `${fmt(p.messages)} mensagens no ano todo. Lê tudo, fala pouco`,
  },
  presenca: {
    title: 'Presença garantida',
    emoji: '🙌',
    describe: (p) => `${fmt(p.messages)} mensagens e sempre por perto`,
  },
}

export function awardInfo(a: Award, r: Retro): { title: string; emoji: string; description: string } {
  const p = r.people[a.person]
  const def = AWARDS.find((d) => d.id === a.id)
  if (def) return { title: def.title, emoji: def.emoji, description: def.describe(a.value, p, r) }
  const fb = FALLBACK_AWARDS[a.id] ?? FALLBACK_AWARDS.presenca
  return { title: fb.title, emoji: fb.emoji, description: fb.describe(p) }
}

export function silenceLabel(hours: number): string {
  if (hours >= 48) return `${hours / 24} dias`
  if (hours >= 24) return 'um dia'
  return `${hours} horas`
}

export function durationLabel(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} segundos`
  const min = Math.round(s / 60)
  if (min < 60) return min === 1 ? '1 minuto' : `${min} minutos`
  const h = Math.floor(min / 60)
  const rest = min % 60
  if (h < 48) return rest && h < 10 ? `${h}h${String(rest).padStart(2, '0')}` : `${h} horas`
  return `${Math.round(h / 24)} dias`
}

/**
 * Distribui um título por pessoa. A cada rodada escolhe o par (categoria, pessoa)
 * em que a pessoa mais se destaca sobre o próximo candidato livre.
 */
export function computeAwards(r: Retro): Award[] {
  const n = r.people.length
  if (n === 0) return []
  const values = AWARDS.map((def) => r.people.map((p) => def.metric(p, r)))
  // Quem quase não fala não concorre a categoria nenhuma
  const average = r.totals.messages / n
  const eligible = (p: number) => n < 3 || r.people[p].messages >= average * 0.25
  const rankings = values.map((vals, c) =>
    vals
      .map((v, p) => [p, v] as const)
      .filter(([p, v]) => eligible(p) && v > 0 && v >= AWARDS[c].min)
      .sort((a, b) => b[1] - a[1]),
  )

  const awards: Award[] = []
  const personDone = new Set<number>()
  const catDone = new Set<number>()

  // "Alma do grupo" só faz sentido se for disputado; deixa por último
  const almaIdx = AWARDS.findIndex((d) => d.id === 'alma')

  for (;;) {
    let best: { c: number; p: number; score: number } | null = null
    for (let c = 0; c < AWARDS.length; c++) {
      if (catDone.has(c)) continue
      const free = rankings[c].filter(([p]) => !personDone.has(p))
      if (free.length === 0) continue
      const [p, v] = free[0]
      // Só ganha quem está perto de quem lidera a categoria
      if (v < rankings[c][0][1] * 0.5) continue
      const position = rankings[c].findIndex(([q]) => q === p)
      const next = free[1]?.[1] ?? 0
      // Suaviza para 3 contra 1 não parecer domínio absoluto
      const k = AWARDS[c].min >= 1 ? AWARDS[c].min : 0
      const dominance = next > 0 ? (v + k) / (next + k) : 3
      const score = Math.min(dominance, 3) * Math.pow(0.6, position) * (c === almaIdx ? 0.5 : 1)
      if (!best || score > best.score) best = { c, p, score }
    }
    if (!best) break
    awards.push({ id: AWARDS[best.c].id, person: best.p, value: values[best.c][best.p] })
    personDone.add(best.p)
    catDone.add(best.c)
  }

  // Quem sobrou
  const leftover = r.people.map((_, p) => p).filter((p) => !personDone.has(p))
  leftover.sort((a, b) => r.people[a].messages - r.people[b].messages)
  leftover.forEach((p, i) => {
    const ghost = i === 0 && n >= 4 && r.people[p].messages < r.totals.messages / n / 4
    awards.push({ id: ghost ? 'fantasma' : 'presenca', person: p, value: r.people[p].messages })
  })

  return awards.sort((a, b) => a.person - b.person)
}
