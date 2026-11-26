import { captionOf, type Message, type MessageKind } from './parser'
import { isStopword, URL_RE, domainOf, emojis, isCaps, laughType, tokens, type LaughType } from './text'
import { computeAwards, type Award } from './awards'
import { holidayName } from './holidays'

export type MediaKind = 'sticker' | 'audio' | 'image' | 'video' | 'gif' | 'document' | 'media'
export const MEDIA_KINDS: MediaKind[] = ['sticker', 'audio', 'image', 'video', 'gif', 'document', 'media']

export interface Excerpt {
  person: number
  ts: number
  text?: string // ausente quando os trechos foram removidos
  words?: number
}

export interface TopDay {
  ts: number
  count: number
  holiday: string | null
  words?: string[] // palavras que se destacaram naquele dia
  person: number
  personCount: number
  peakHour: number
  photos: number
  topic?: string // descoberto pela IA, quando ligada
}

export interface PersonStats {
  name: string
  photo?: string // escolhida na configuração; o export não traz fotos
  messages: number
  words: number
  textMessages: number
  shortMessages: number
  media: Record<MediaKind, number>
  deleted: number
  edited: number
  polls: number
  laughs: number
  laughTypes: Partial<Record<LaughType, number>>
  emojiCount: number
  topEmojis: [string, number][]
  hours: number[]
  night: number
  dayOpeners: number
  revives: number
  caps: number
  questions: number
  unanswered: number
  links: number
  longestRun: number
  replyMedianSec: number | null
  partner: number
  partnerCount: number
  catchphrases?: string[]
  // Para a retrospectiva individual
  months: number[] // na mesma ordem de Retro.months
  week: number[] // domingo primeiro
  activeDays: number
  busiestDay: { ts: number; count: number } | null
  laughedBy: [number, number][] // quem mais riu das mensagens dela: [pessoa, vezes]
  laughedAt: [number, number][] // de quem ela mais riu
  funny?: FunnyMoment | null // o momento engraçado provocado por ela
}

export interface ChatBubble {
  person: number
  ts: number
  kind: MessageKind
  text?: string // texto, ou a legenda de uma foto
  file?: string // anexo, para buscar a imagem no zip
  media?: string // miniatura (data URL) da figurinha ou foto
  audio?: string // o áudio: endereço local enquanto o zip está aberto; no cofre vai o arquivo inteiro
}

export type FunnyMetric = 'pessoas' | 'pura' | 'gargalhada' | 'texto'

export const FUNNY_METRICS: Record<FunnyMetric, { label: string; description: string }> = {
  pessoas: { label: 'Pessoas rindo', description: 'Quantas pessoas diferentes riram nos 5 minutos seguintes.' },
  pura: { label: 'Risada pura', description: 'Só a sequência de risadas logo depois; para quando a conversa volta ao normal.' },
  gargalhada: { label: 'Gargalhada', description: 'O tamanho das risadas: KKKKKKKKKK vale mais que kk.' },
  texto: { label: 'Só piada escrita', description: 'Como a risada pura, mas quem provocou foi uma mensagem de texto.' },
}

export type FunnyCategory = 'geral' | 'audio' | 'sticker'

export interface FunnyPick {
  category: FunnyCategory
  moment: FunnyMoment
  /** Até 5 candidatos para quem gerou escolher; não vão no link */
  options?: FunnyMoment[]
  choice?: number
}

/** A mensagem que provocou uma onda de risadas, com o contexto antes e as reações depois. */
export interface FunnyMoment {
  bubbles: ChatBubble[]
  trigger: number // posição da mensagem que fez todo mundo rir
  laughers: number
  laughs: number
  purity: number // fração das reações que foram risada (0 a 1)
  size: number // soma do tamanho das risadas
  score: number
}

export interface LongText {
  person: number
  ts: number
  words: number
  topic?: string
}

export interface Retro {
  v: 1
  group: string
  period: { label: string; start: number; end: number; kind?: PeriodKind }
  people: PersonStats[]
  totals: {
    messages: number
    words: number
    activeDays: number
    periodDays: number
    media: Record<MediaKind, number>
    laughs: number
    emojis: number
    links: number
    deleted: number
    edited: number
    polls: number
  }
  mediaTyped: boolean
  heat: number[] // 7 dias × 24 horas, domingo primeiro
  months: { label: string; count: number }[]
  topDays: TopDay[]
  streak: { days: number; start: number; end: number } | null
  silence: { ms: number; start: number; end: number } | null
  topEmojis: [string, number][]
  topWords?: [string, number][]
  laughTypes: Partial<Record<LaughType, number>>
  longestLaugh: { person: number; text: string } | null
  domains: [string, number][]
  pairs: [number, number, number][]
  reviveThresholdH: number
  monologue: { person: number; len: number; ts: number } | null
  first: Excerpt | null
  last: Excerpt | null
  longTexts: LongText[]
  /** O momento mais engraçado no geral e, quando diferentes, o do áudio, da figurinha e da mensagem escrita */
  funnies: FunnyPick[]
  awards: Award[]
  excerpts: boolean
}

export type PeriodKind = 'year' | 'all' | 'custom'

export interface Period {
  label: string
  start: number
  end: number // exclusivo
  kind?: PeriodKind
}

/** Tipo do período (links antigos não guardavam: deduz pelo rótulo). */
export function periodKind(r: Pick<Retro, 'period'>): PeriodKind {
  return r.period.kind ?? (/^\d{4}$/.test(r.period.label) ? 'year' : 'all')
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Período personalizado a partir de duas datas no formato do campo de data (aaaa-mm-dd). */
export function customPeriod(from: string, to: string): Period {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  const label = y1 === y2 ? `${pad2(d1)}/${pad2(m1)} a ${pad2(d2)}/${pad2(m2)}/${y2}` : `${pad2(d1)}/${pad2(m1)}/${y1} a ${pad2(d2)}/${pad2(m2)}/${y2}`
  return { label, start: new Date(y1, m1 - 1, d1).getTime(), end: new Date(y2, m2 - 1, d2 + 1).getTime(), kind: 'custom' }
}

const HOUR = 3_600_000
const DAY = 86_400_000
const REPLY_WINDOW = 5 * 60_000
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function localDayIndex(ts: number): number {
  const d = new Date(ts)
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY)
}

function dayIndexToTs(idx: number): number {
  const d = new Date(idx * DAY)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime()
}

function topN<K>(map: Map<K, number>, n: number): [K, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function emptyMedia(): Record<MediaKind, number> {
  return { sticker: 0, audio: 0, image: 0, video: 0, gif: 0, document: 0, media: 0 }
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean
}

export function availablePeriods(messages: Message[]): Period[] {
  const years = new Set<number>()
  for (const m of messages) if (m.author !== null) years.add(new Date(m.ts).getFullYear())
  const sorted = [...years].sort((a, b) => b - a)
  const periods: Period[] = sorted.map((y) => ({
    label: String(y),
    start: new Date(y, 0, 1).getTime(),
    end: new Date(y + 1, 0, 1).getTime(),
    kind: 'year' as const,
  }))
  if (sorted.length > 1) periods.push({ label: 'Desde o começo', start: 0, end: 8.64e15, kind: 'all' })
  return periods
}

export function computeRetro(all: Message[], group: string, period: Period): Retro {
  const msgs = all.filter((m) => m.author !== null && m.ts >= period.start && m.ts < period.end)

  const counts = new Map<string, number>()
  for (const m of msgs) counts.set(m.author!, (counts.get(m.author!) ?? 0) + 1)
  const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
  const idx = new Map(names.map((n, i) => [n, i]))
  const nameParts = new Set(names.flatMap((n) => tokens(n.toLowerCase())))

  const people: PersonStats[] = names.map((name) => ({
    name,
    messages: 0,
    words: 0,
    textMessages: 0,
    shortMessages: 0,
    media: emptyMedia(),
    deleted: 0,
    edited: 0,
    polls: 0,
    laughs: 0,
    laughTypes: {},
    emojiCount: 0,
    topEmojis: [],
    hours: new Array(24).fill(0),
    night: 0,
    dayOpeners: 0,
    revives: 0,
    caps: 0,
    questions: 0,
    unanswered: 0,
    links: 0,
    longestRun: 0,
    replyMedianSec: null,
    partner: -1,
    partnerCount: 0,
    months: [],
    week: new Array(7).fill(0),
    activeDays: 0,
    busiestDay: null,
    laughedBy: [],
    laughedAt: [],
  }))
  const personDays = names.map(() => new Map<number, number>())
  const personMonths = names.map(() => new Map<string, number>())

  const heat = new Array(7 * 24).fill(0)
  const dayCounts = new Map<number, number>()
  const monthCounts = new Map<string, number>()
  const groupEmojis = new Map<string, number>()
  const personEmojis = names.map(() => new Map<string, number>())
  const personWords = names.map(() => new Map<string, number>())
  const groupWords = new Map<string, number>()
  const domains = new Map<string, number>()
  const laughTotals: Partial<Record<LaughType, number>> = {}
  let longestLaugh: { person: number; text: string } | null = null
  const replyTimes: number[][] = names.map(() => [])
  const pairCounts = new Map<string, number>()
  const replyTo = names.map(() => new Map<number, number>())

  const spanMonths =
    msgs.length > 0
      ? (new Date(msgs[msgs.length - 1].ts).getFullYear() - new Date(msgs[0].ts).getFullYear()) * 12 +
        new Date(msgs[msgs.length - 1].ts).getMonth() -
        new Date(msgs[0].ts).getMonth() +
        1
      : 0
  const singleYear = msgs.length === 0 || new Date(msgs[0].ts).getFullYear() === new Date(msgs[msgs.length - 1].ts).getFullYear()
  const monthKey = (d: Date) =>
    singleYear ? MONTHS[d.getMonth()] : spanMonths > 24 ? String(d.getFullYear()) : `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`

  const totals = {
    messages: msgs.length,
    words: 0,
    activeDays: 0,
    periodDays: 0,
    media: emptyMedia(),
    laughs: 0,
    emojis: 0,
    links: 0,
    deleted: 0,
    edited: 0,
    polls: 0,
  }

  const longTexts: LongText[] = []
  let run = 0
  let monologue: Retro['monologue'] = null

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]
    const p = idx.get(m.author!)!
    const ps = people[p]
    const d = new Date(m.ts)
    ps.messages++
    ps.hours[d.getHours()]++
    if (d.getHours() < 5) ps.night++
    heat[d.getDay() * 24 + d.getHours()]++
    const di = localDayIndex(m.ts)
    dayCounts.set(di, (dayCounts.get(di) ?? 0) + 1)
    personDays[p].set(di, (personDays[p].get(di) ?? 0) + 1)
    ps.week[d.getDay()]++
    const mk = monthKey(d)
    monthCounts.set(mk, (monthCounts.get(mk) ?? 0) + 1)
    personMonths[p].set(mk, (personMonths[p].get(mk) ?? 0) + 1)
    if (m.edited) {
      ps.edited++
      totals.edited++
    }

    // Sequência de mensagens seguidas da mesma pessoa
    const prev = i > 0 ? msgs[i - 1] : null
    if (prev && prev.author === m.author) run++
    else run = 1
    if (run > ps.longestRun) ps.longestRun = run
    if (!monologue || run > monologue.len) monologue = { person: p, len: run, ts: m.ts }

    // Quem responde quem
    if (prev && prev.author !== m.author) {
      const gap = m.ts - prev.ts
      const q = idx.get(prev.author!)!
      if (gap <= REPLY_WINDOW) {
        const key = p < q ? `${p}|${q}` : `${q}|${p}`
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
        replyTo[p].set(q, (replyTo[p].get(q) ?? 0) + 1)
        replyTo[q].set(p, (replyTo[q].get(p) ?? 0) + 1)
      }
      if (gap <= 6 * HOUR) replyTimes[p].push(gap)
    }

    const kind: MessageKind = m.kind
    if (kind === 'deleted') {
      ps.deleted++
      totals.deleted++
      continue
    }
    if (kind === 'poll') {
      ps.polls++
      totals.polls++
      continue
    }
    if ((MEDIA_KINDS as string[]).includes(kind)) {
      ps.media[kind as MediaKind]++
      totals.media[kind as MediaKind]++
      continue
    }
    if (kind !== 'text') continue

    const text = m.text
    const urls = text.match(URL_RE) ?? []
    if (urls.length) {
      ps.links += urls.length
      totals.links += urls.length
      for (const u of urls) {
        const dom = domainOf(u)
        if (dom) domains.set(dom, (domains.get(dom) ?? 0) + 1)
      }
    }
    const withoutUrls = urls.length ? text.replace(URL_RE, ' ') : text
    const toks = tokens(withoutUrls)
    ps.textMessages++
    ps.words += toks.length
    totals.words += toks.length
    if (toks.length <= 2) ps.shortMessages++

    const laughFree: string[] = []
    for (const t of toks) {
      const lt = laughType(t)
      if (lt) {
        ps.laughs++
        totals.laughs++
        ps.laughTypes[lt] = (ps.laughTypes[lt] ?? 0) + 1
        laughTotals[lt] = (laughTotals[lt] ?? 0) + 1
        if (lt === 'kkk' && (!longestLaugh || t.length > longestLaugh.text.length)) longestLaugh = { person: p, text: t }
        continue
      }
      laughFree.push(t)
      const w = t.toLowerCase()
      if (isContentWord(w, nameParts)) {
        personWords[p].set(w, (personWords[p].get(w) ?? 0) + 1)
        groupWords.set(w, (groupWords.get(w) ?? 0) + 1)
      }
    }

    if (isCaps(laughFree)) ps.caps++
    if (/\?\s*[\p{Extended_Pictographic}\s]*$/u.test(text)) ps.questions++

    const ems = emojis(text)
    if (ems.length) {
      ps.emojiCount += ems.length
      totals.emojis += ems.length
      for (const e of ems) {
        personEmojis[p].set(e, (personEmojis[p].get(e) ?? 0) + 1)
        groupEmojis.set(e, (groupEmojis.get(e) ?? 0) + 1)
      }
    }

    // Guarda só os 5 maiores (quem, quando e quantas palavras; o texto não)
    if (toks.length >= 20 && (longTexts.length < 5 || toks.length > longTexts[longTexts.length - 1].words)) {
      longTexts.push({ person: p, ts: m.ts, words: toks.length })
      longTexts.sort((a, b) => b.words - a.words)
      if (longTexts.length > 5) longTexts.pop()
    }
  }

  // Quem puxa assunto no dia (dia começando às 4h) e quem ressuscita o grupo
  const gaps: number[] = []
  let lastDay = -Infinity
  for (let i = 0; i < msgs.length; i++) {
    const shifted = localDayIndex(msgs[i].ts - 4 * HOUR)
    if (shifted !== lastDay) {
      people[idx.get(msgs[i].author!)!].dayOpeners++
      lastDay = shifted
    }
    if (i > 0) gaps.push(msgs[i].ts - msgs[i - 1].ts)
  }
  let reviveThresholdH = 6
  for (const h of [72, 48, 24, 12]) {
    if (gaps.filter((g) => g >= h * HOUR).length >= 6) {
      reviveThresholdH = h
      break
    }
  }
  let silence: Retro['silence'] = null
  for (let i = 1; i < msgs.length; i++) {
    const gap = msgs[i].ts - msgs[i - 1].ts
    if (gap >= reviveThresholdH * HOUR) people[idx.get(msgs[i].author!)!].revives++
    if (!silence || gap > silence.ms) silence = { ms: gap, start: msgs[i - 1].ts, end: msgs[i].ts }
  }

  // Perguntas que ficaram no vácuo: ninguém mais falou por 1h, em horário acordado
  let nextOther = -1
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (i + 1 < msgs.length && msgs[i + 1].author !== m.author) nextOther = i + 1
    const h = new Date(m.ts).getHours()
    if (m.kind === 'text' && h >= 8 && h < 23 && /\?\s*[\p{Extended_Pictographic}\s]*$/u.test(m.text)) {
      const waited = nextOther > i && msgs[nextOther].author !== m.author ? msgs[nextOther].ts - m.ts : Infinity
      if (waited >= HOUR) people[idx.get(m.author!)!].unanswered++
    }
  }

  // Dias ativos e maior sequência
  const days = [...dayCounts.keys()].sort((a, b) => a - b)
  totals.activeDays = days.length
  let streak: Retro['streak'] = null
  let runStart = 0
  for (let i = 0; i < days.length; i++) {
    if (i === 0 || days[i] !== days[i - 1] + 1) runStart = i
    const len = i - runStart + 1
    if (!streak || len > streak.days) streak = { days: len, start: dayIndexToTs(days[runStart]), end: dayIndexToTs(days[i]) }
  }
  if (days.length) {
    const lastDayOfPeriod = Math.min(localDayIndex(Math.min(period.end - 1, Date.now())), days[days.length - 1])
    // Conta a partir da primeira mensagem, para grupos criados no meio do ano
    const firstDayOfPeriod = days[0]
    totals.periodDays = Math.max(1, lastDayOfPeriod - firstDayOfPeriod + 1)
  }

  const totalWordCount = [...groupWords.values()].reduce((a, b) => a + b, 0)
  const topDays = computeTopDays(msgs, dayCounts, idx, groupWords, totalWordCount, nameParts)

  let months: Retro['months']
  if (singleYear) {
    const firstMonth = msgs.length ? new Date(msgs[0].ts).getMonth() : 0
    const lastMonth = msgs.length ? new Date(msgs[msgs.length - 1].ts).getMonth() : 11
    months = MONTHS.slice(firstMonth, lastMonth + 1).map((label) => ({ label, count: monthCounts.get(label) ?? 0 }))
  }
  else if (spanMonths <= 24) {
    // Período atravessando a virada do ano: todos os meses em ordem, inclusive os sem mensagem
    months = []
    const d = new Date(new Date(msgs[0].ts).getFullYear(), new Date(msgs[0].ts).getMonth(), 1)
    for (let k = 0; k < spanMonths; k++, d.setMonth(d.getMonth() + 1)) {
      const label = monthKey(d)
      months.push({ label, count: monthCounts.get(label) ?? 0 })
    }
  } else months = [...monthCounts.entries()].map(([label, count]) => ({ label, count }))

  // Por pessoa: meses, dias ativos e o dia em que mais falou
  people.forEach((ps, p) => {
    ps.months = months.map((m) => personMonths[p].get(m.label) ?? 0)
    ps.activeDays = personDays[p].size
    for (const [di, c] of personDays[p]) if (!ps.busiestDay || c > ps.busiestDay.count) ps.busiestDay = { ts: dayIndexToTs(di), count: c }
  })

  // Quem ri de quem: cada risada conta para a mensagem de outra pessoa logo antes.
  // Para escolher UM momento isso erra (as pessoas comentam antes de rir), mas somado no ano dá uma boa ideia.
  const laughs = msgs.map(laughInfo)
  const laughMatrix = names.map(() => new Array(names.length).fill(0)) // [quem fez rir][quem riu]
  for (let j = 0; j < msgs.length; j++) {
    if (laughs[j].laughs === 0) continue
    for (let k = j - 1; k >= 0 && k >= j - 6 && msgs[j].ts - msgs[k].ts <= 3 * 60_000; k--) {
      if (msgs[k].author === msgs[j].author || laughs[k].only || msgs[k].kind === 'system') continue
      laughMatrix[idx.get(msgs[k].author!)!][idx.get(msgs[j].author!)!]++
      break
    }
  }
  const top3 = (row: number[]): [number, number][] =>
    row
      .map((c, q) => [q, c] as [number, number])
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  people.forEach((ps, p) => {
    ps.laughedBy = top3(laughMatrix[p])
    ps.laughedAt = top3(laughMatrix.map((row) => row[p]))
    ps.funny = funnyMoments(msgs, idx, names.length, DEFAULT_FUNNY, 1, undefined, ps.name)[0] ?? null
  })

  // Bordões: palavras que a pessoa usa bem mais que o resto do grupo
  people.forEach((ps, p) => {
    ps.topEmojis = topN(personEmojis[p], 3)
    const mine = personWords[p]
    const myTotal = [...mine.values()].reduce((a, b) => a + b, 0)
    const othersTotal = totalWordCount - myTotal
    const minCount = Math.max(3, Math.ceil(myTotal * 0.0008))
    const scored: [string, number][] = []
    if (names.length > 1 && othersTotal > 0) {
      for (const [w, c] of mine) {
        if (c < minCount) continue
        const others = (groupWords.get(w) ?? 0) - c
        const ratio = c / myTotal / ((others + 1) / othersTotal)
        if (ratio >= 2.5) scored.push([w, c * Math.log(ratio)])
      }
    }
    ps.catchphrases = scored.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w)

    const med = median(replyTimes[p])
    ps.replyMedianSec = replyTimes[p].length >= 15 && med !== null ? Math.round(med / 1000) : null

    let best = -1
    let bestCount = 0
    for (const [q, c] of replyTo[p]) if (c > bestCount) [best, bestCount] = [q, c]
    ps.partner = best
    ps.partnerCount = bestCount
  })

  const pairs: [number, number, number][] = topN(pairCounts, 5).map(([key, c]) => {
    const [a, b] = key.split('|').map(Number)
    return [a, b, c]
  })

  const firstText = msgs.find((m) => m.kind === 'text')
  const lastText = [...msgs].reverse().find((m) => m.kind === 'text')
  const asExcerpt = (m: Message | undefined): Excerpt | null =>
    m ? { person: idx.get(m.author!)!, ts: m.ts, text: m.text } : null

  const retro: Retro = {
    v: 1,
    group,
    period: {
      label: period.label,
      start: msgs[0]?.ts ?? period.start,
      end: msgs[msgs.length - 1]?.ts ?? period.end,
      kind: period.kind ?? (/^\d{4}$/.test(period.label) ? 'year' : 'all'),
    },
    people,
    totals,
    mediaTyped: MEDIA_KINDS.some((k) => k !== 'media' && totals.media[k] > 0),
    heat,
    months,
    topDays,
    streak,
    silence,
    topEmojis: topN(groupEmojis, 10),
    topWords: topN(groupWords, 12),
    laughTypes: laughTotals,
    longestLaugh,
    domains: topN(domains, 5),
    pairs,
    reviveThresholdH,
    monologue,
    first: asExcerpt(firstText),
    last: asExcerpt(lastText),
    longTexts,
    funnies: pickFunnies(msgs, idx, names.length),
    awards: [],
    excerpts: true,
  }
  retro.awards = computeAwards(retro)
  return finalizeExcerpts(retro)
}

const FUNNY_WINDOW = 5 * 60_000
export const DEFAULT_FUNNY: FunnyMetric = 'pura'

interface LaughInfo {
  laughs: number
  only: boolean // a mensagem é praticamente só risada
  size: number
}

// Reações que mostram que a pessoa riu de verdade
const STRONG_LAUGH = /\b(?:morri|morrendo|chorando|chorei|socorro|rachei|gargalhei|me mijei|n[aã]o aguento|mds|meu deus)\b|\u{1F480}/iu
const LAUGH_EMOJI = /\u{1F602}|\u{1F923}|\u{1F639}|\u{1F480}/gu // rindo, rolando de rir, gato rindo, caveira

function laughInfo(m: Message): LaughInfo {
  if (m.kind !== 'text') return { laughs: 0, only: false, size: 0 }
  const toks = tokens(m.text)
  const laughs = toks.filter((t) => laughType(t))
  const emojiLaughs = m.text.match(LAUGH_EMOJI)?.length ?? 0
  // RISADA EM CAIXA ALTA pesa mais; cada emoji de risada vale como um "kkkk"
  const size = laughs.reduce((s, l) => s + Math.min(l.length, 40) * (l === l.toUpperCase() ? 1.5 : 1), 0) + Math.min(emojiLaughs, 6) * 4
  const strong = STRONG_LAUGH.test(m.text) // "morri", "chorando", "socorro", caveira
  const count = laughs.length + (emojiLaughs > 0 || strong ? 1 : 0)
  return { laughs: count, only: count > 0 && toks.length - laughs.length <= 3, size: size + (strong ? 15 : 0) }
}

function bubbleOf(m: Message, idx: Map<string, number>): ChatBubble {
  const text = m.kind === 'text' ? m.text : captionOf(m.text)
  return {
    person: idx.get(m.author!)!,
    ts: m.ts,
    kind: m.kind,
    ...(text ? { text: truncate(text, 220) } : {}),
    ...(m.file ? { file: m.file } : {}),
  }
}

/**
 * Os momentos que mais fizeram o grupo rir, segundo um critério.
 * Devolve até `n` momentos que não se sobrepõem, do mais forte para o mais fraco.
 */
function pickFunnies(msgs: Message[], idx: Map<string, number>, people: number): FunnyPick[] {
  const overallOptions = funnyMoments(msgs, idx, people, DEFAULT_FUNNY, 5)
  const overall = overallOptions[0]
  if (!overall) return []
  const picks: FunnyPick[] = [{ category: 'geral', moment: overall, options: overallOptions }]
  const overallTs = overall.bubbles[overall.trigger].ts
  for (const kind of ['audio', 'sticker'] as const) {
    // Pula o que for da mesma conversa do momento geral (a figurinha logo antes do áudio, por exemplo)
    // Áudio e figurinha só valem se o arquivo veio no export (senão não dá para ouvir nem ver)
    const options = funnyMoments(msgs, idx, people, DEFAULT_FUNNY, 12, kind)
      .filter((x) => Math.abs(x.bubbles[x.trigger].ts - overallTs) >= 10 * 60_000 && !!x.bubbles[x.trigger].file)
      .slice(0, 5)
    if (options.length) picks.push({ category: kind, moment: options[0], options })
  }
  return picks
}

export function funnyMoments(
  msgs: Message[],
  idx: Map<string, number>,
  people: number,
  metric: FunnyMetric,
  n: number,
  triggerKind?: MessageKind,
  author?: string,
): FunnyMoment[] {
  const info = msgs.map(laughInfo)
  // Grupos que riem pouco raramente têm 3 pessoas rindo juntas; a pontuação já favorece quem fez mais gente rir
  const minPeople = Math.min(2, people - 1)
  const found: { i: number; end: number; m: Omit<FunnyMoment, 'bubbles' | 'trigger'> }[] = []

  for (let i = 0; i < msgs.length; i++) {
    const t = msgs[i]
    if (info[i].only || t.kind === 'deleted' || t.kind === 'system') continue
    if (metric === 'texto' && t.kind !== 'text') continue
    if (triggerKind && t.kind !== triggerKind) continue
    if (author && t.author !== author) continue
    const who = new Set<string>()
    let laughs = 0
    let others = 0
    let size = 0
    let end = i
    let calm = 0 // mensagens seguidas sem risada
    for (let j = i + 1; j < msgs.length && j <= i + 15 && msgs[j].ts - t.ts <= FUNNY_WINDOW; j++) {
      const isLaugh = info[j].laughs > 0 && msgs[j].author !== t.author
      if (metric === 'pura' || metric === 'texto') {
        if (!isLaugh) {
          calm++
          // A onda acabou quando a conversa volta ao normal
          if (calm >= 3) break
          others++
        } else calm = 0
      } else if (!isLaugh) others++
      end = j
      if (isLaugh) {
        who.add(msgs[j].author!)
        laughs++
        size += info[j].size
      }
    }
    if (who.size < minPeople) continue
    const purity = laughs / Math.max(1, laughs + others)
    let score: number
    if (metric === 'pessoas') score = who.size * 3 + laughs + size / 10
    else if (metric === 'gargalhada') score = size / 10 + who.size
    else score = (who.size * 2 + laughs) * (0.4 + 0.6 * purity)
    // Corta o fim da janela nas reações (não mostra a conversa que veio depois)
    while (end > i && !(info[end].laughs > 0 && msgs[end].author !== t.author)) end--
    found.push({ i, end, m: { laughers: who.size, laughs, purity, size, score } })
  }

  found.sort((a, b) => b.m.score - a.m.score)
  const picked: typeof found = []
  for (const f of found) {
    // Mesma conversa (até 10 minutos de distância) conta como um momento só
    if (picked.some((p) => Math.abs(msgs[p.i].ts - msgs[f.i].ts) < 10 * 60_000)) continue
    picked.push(f)
    if (picked.length >= n) break
  }

  return picked.map(({ i, end, m }) => {
    let start = i
    while (start > i - 3 && start > 0 && msgs[i].ts - msgs[start - 1].ts <= 10 * 60_000) start--
    const last = Math.min(end, i + 8)
    return { ...m, bubbles: msgs.slice(start, last + 1).map((x) => bubbleOf(x, idx)), trigger: i - start }
  })
}

function isContentWord(w: string, nameParts: Set<string>): boolean {
  return w.length >= 3 && !isStopword(w) && !/^\d+$/.test(w) && !nameParts.has(w) && !laughType(w)
}

/** Os 3 dias com mais mensagens e as pistas do porquê. */
function computeTopDays(
  msgs: Message[],
  dayCounts: Map<number, number>,
  idx: Map<string, number>,
  groupWords: Map<string, number>,
  totalWords: number,
  nameParts: Set<string>,
): TopDay[] {
  const top = [...dayCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const wanted = new Set(top.map(([d]) => d))
  const info = new Map(
    top.map(([d]) => [d, { people: new Map<number, number>(), hours: new Array(24).fill(0), photos: 0, words: new Map<string, number>(), total: 0 }]),
  )
  for (const m of msgs) {
    const day = localDayIndex(m.ts)
    if (!wanted.has(day)) continue
    const it = info.get(day)!
    const p = idx.get(m.author!)!
    it.people.set(p, (it.people.get(p) ?? 0) + 1)
    it.hours[new Date(m.ts).getHours()]++
    if (m.kind === 'image' || m.kind === 'video') it.photos++
    if (m.kind !== 'text') continue
    for (const t of tokens(m.text.replace(URL_RE, ' '))) {
      const w = t.toLowerCase()
      if (!isContentWord(w, nameParts)) continue
      it.words.set(w, (it.words.get(w) ?? 0) + 1)
      it.total++
    }
  }
  return top.map(([day, count]) => {
    const it = info.get(day)!
    const [person, personCount] = [...it.people.entries()].sort((a, b) => b[1] - a[1])[0]
    const restTotal = Math.max(1, totalWords - it.total)
    const words = [...it.words.entries()]
      .filter(([, c]) => c >= 3)
      .map(([w, c]) => {
        const rest = (groupWords.get(w) ?? 0) - c
        const ratio = c / Math.max(1, it.total) / ((rest + 1) / restTotal)
        return [w, ratio >= 3 ? c * Math.log(ratio) : 0] as const
      })
      .filter(([, s]) => s > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([w]) => w)
    const ts = dayIndexToTs(day)
    return { ts, count, holiday: holidayName(ts), words, person, personCount, peakHour: it.hours.indexOf(Math.max(...it.hours)), photos: it.photos }
  })
}

function finalizeExcerpts(r: Retro): Retro {
  const cut = (e: Excerpt | null, max: number) => (e && e.text ? { ...e, text: truncate(e.text, max) } : e)
  r.first = cut(r.first, 160)
  r.last = cut(r.last, 160)
  return r
}

/** Versão para compartilhar: tira trechos de mensagens e/ou palavras. */
export function stripForShare(r: Retro, opts: { excerpts: boolean; words: boolean }): Retro {
  const copy: Retro = structuredClone(r)
  if (!opts.excerpts) {
    const strip = (e: Excerpt | null) => (e ? { person: e.person, ts: e.ts, words: e.words } : null)
    copy.first = strip(copy.first)
    copy.last = strip(copy.last)
    copy.funnies = []
    copy.people.forEach((p) => delete p.funny)
    copy.excerpts = false
  }
  // As outras opções de momento engraçado ficam só com quem gerou
  for (const f of copy.funnies) {
    delete f.options
    delete f.choice
  }
  copy.people.forEach((p) => {
    if (!opts.words) delete p.catchphrases
  })
  if (!opts.words) {
    delete copy.topWords
    copy.topDays.forEach((d) => delete d.words)
  }
  return copy
}
