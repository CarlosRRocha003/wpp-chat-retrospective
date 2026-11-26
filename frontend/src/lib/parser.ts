export type MessageKind =
  | 'text'
  | 'sticker'
  | 'audio'
  | 'image'
  | 'video'
  | 'gif'
  | 'document'
  | 'media' // mídia oculta, sem saber o tipo
  | 'deleted'
  | 'poll'
  | 'location'
  | 'contact'
  | 'system'

export interface Message {
  ts: number
  author: string | null
  text: string
  kind: MessageKind
  edited: boolean
  /** Nome do arquivo anexado (exports "com mídia") */
  file?: string
}

export interface ParsedChat {
  messages: Message[]
  authors: string[]
  /** Nome atual do grupo, quando a conversa tem o aviso de criação ou de troca de nome */
  groupName?: string
}

const GROUP_NAME =
  /(?:mudou o nome do grupo para|mudou o nome de .+? para|mudou o assunto de .+? para|criou (?:o|este) grupo|changed the group name to|changed the subject (?:from .+? )?to|created (?:the )?group) [\u201c"](.+?)[\u201d"]\s*$/i

// Caracteres invisíveis que o WhatsApp espalha no export (LRM, RLM, marcas bidi, NBSP estreito)
const INVISIBLE = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g

// Android: "14/11/2026 13:45 - " | "14/11/26, 1:45 PM - "
const ANDROID_HEADER =
  /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s?([ap])\.?\s?m\.?)? - /i
// iPhone: "[14/11/2026, 13:45:12] " | "[14/11/26 1:45:12 PM] "
const IOS_HEADER =
  /^\[(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s?([ap])\.?\s?m\.?)?\] /i

interface RawLine {
  a: number
  b: number
  year: number
  hour: number
  minute: number
  second: number
  rest: string
}

function matchHeader(line: string): RawLine | null {
  const m = ANDROID_HEADER.exec(line) ?? IOS_HEADER.exec(line)
  if (!m) return null
  let year = Number(m[3])
  if (year < 100) year += 2000
  let hour = Number(m[4])
  const ampm = m[7]?.toLowerCase()
  if (ampm === 'p' && hour < 12) hour += 12
  if (ampm === 'a' && hour === 12) hour = 0
  return {
    a: Number(m[1]),
    b: Number(m[2]),
    year,
    hour,
    minute: Number(m[5]),
    second: Number(m[6] ?? 0),
    rest: line.slice(m[0].length),
  }
}

// Avisos do sistema que às vezes chegam com cara de mensagem: no iPhone vêm com o nome do
// grupo como autor; no Android, quando o nome do grupo tem ": ", a linha se parte no lugar errado.
const SYSTEM_TEXT =
  /^(?:.{1,80} )?(?:criou (?:o|este) grupo|criou o grupo|mudou o nome (?:do grupo|de)|mudou o assunto|mudou a descrição|mudou a imagem|apagou a imagem|adicionou |removeu |saiu$|entrou usando o link|agora é admin|não é mais admin|mudou para |ativou as mensagens temporárias|desativou as mensagens temporárias|alterou as configurações|fixou uma mensagem|created (?:the )?group|changed the (?:subject|group name|group description|group icon)|added |removed |left$|joined using|is now an admin|changed their phone number)/i
const ENCRYPTION = /(?:mensagens e (?:as )?ligações são protegidas|messages and calls are end-to-end encrypted)/i

const EDITED = /\s*<(?:Mensagem editada|Esta mensagem foi editada|This message was edited)>\s*$/i

const DELETED =
  /^(?:Esta mensagem foi apagada|Você apagou esta mensagem|Mensagem apagada|Esta mensagem foi apagada por um admin|This message was deleted|You deleted this message)\.?$/i

// Exportado "sem mídia"
const HIDDEN: Array<[RegExp, MessageKind]> = [
  [/^<(?:Mídia oculta|Media omitted|Arquivo de mídia oculto)>$/i, 'media'],
  [/^(?:imagem ocultada|imagem omitida|image omitted)$/i, 'image'],
  [/^(?:vídeo omitido|vídeo ocultado|video omitted)$/i, 'video'],
  [/^(?:áudio omitido|áudio ocultado|audio omitted)$/i, 'audio'],
  [/^(?:figurinha omitida|figurinha ocultada|sticker omitted)$/i, 'sticker'],
  [/^(?:GIF omitido|GIF ocultado|GIF omitted)$/i, 'gif'],
  [/^(?:documento omitido|document omitted)\b/i, 'document'],
  [/^(?:cartão de contato omitido|Contact card omitted)$/i, 'contact'],
]

// Exportado "com mídia": o nome do arquivo vem na mensagem
// iPhone: "<anexado: arquivo>" pode vir depois da legenda; Android: "arquivo (arquivo anexado)" no começo
const ATTACHED_IOS = /<(?:anexado|attached): ([^>]+)>/i
const ATTACHED_ANDROID = /^(.+?) \((?:arquivo anexado|file attached)\)/i

function kindFromFileName(name: string): MessageKind {
  const upper = name.toUpperCase()
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (upper.startsWith('STK-') || upper.includes('-STICKER-') || ext === 'webp') return 'sticker'
  if (upper.startsWith('PTT-') || upper.startsWith('AUD-') || upper.includes('-AUDIO-') || ['opus', 'ogg', 'm4a', 'mp3', 'aac'].includes(ext))
    return 'audio'
  if (upper.includes('-GIF-') || ext === 'gif') return 'gif'
  if (upper.startsWith('VID-') || upper.includes('-VIDEO-') || ['mp4', 'mov', '3gp'].includes(ext)) return 'video'
  if (upper.startsWith('IMG-') || upper.includes('-PHOTO-') || ['jpg', 'jpeg', 'png', 'heic'].includes(ext)) return 'image'
  if (ext === 'vcf') return 'contact'
  return 'document'
}

export function attachmentName(text: string): string | undefined {
  const att = ATTACHED_IOS.exec(text.trim()) ?? ATTACHED_ANDROID.exec(text.trim())
  return att ? att[1].trim() : undefined
}

/** O texto que acompanha um anexo (legenda), sem a marcação do arquivo. */
export function captionOf(text: string): string | undefined {
  // "figurinha omitida", "<Mídia oculta>" etc. são avisos, não legenda
  if (HIDDEN.some(([re]) => re.test(text.trim()))) return undefined
  const c = text
    .replace(ATTACHED_IOS, '')
    .replace(ATTACHED_ANDROID, '')
    .trim()
  return c || undefined
}

export function classify(text: string): MessageKind {
  const t = text.trim()
  if (DELETED.test(t)) return 'deleted'
  for (const [re, kind] of HIDDEN) if (re.test(t)) return kind
  const att = ATTACHED_IOS.exec(t) ?? ATTACHED_ANDROID.exec(t)
  if (att) return kindFromFileName(att[1].trim())
  if (/^(?:ENQUETE|POLL):/i.test(t)) return 'poll'
  if (/^(?:localização|location|localização em tempo real compartilhada|live location shared)\b/i.test(t)) return 'location'
  if (/\.vcf \((?:arquivo anexado|file attached)\)$/i.test(t)) return 'contact'
  return 'text'
}

// Datas podem vir como DD/MM ou MM/DD. Decide olhando o arquivo inteiro.
function detectDayFirst(lines: RawLine[]): boolean {
  let aOver12 = 0
  let bOver12 = 0
  for (const l of lines) {
    if (l.a > 12) aOver12++
    if (l.b > 12) bOver12++
  }
  if (bOver12 > 0 && aOver12 === 0) return false
  return true
}

/**
 * Separa "Autor: mensagem". O nome pode ter ": " dentro só em casos raros,
 * então usa o primeiro separador e confere contra os autores já vistos.
 */
function splitAuthor(rest: string): { author: string | null; text: string } {
  const idx = rest.indexOf(': ')
  if (idx <= 0 || idx > 80) return { author: null, text: rest }
  return { author: rest.slice(0, idx).trim(), text: rest.slice(idx + 2) }
}

export function parseChat(raw: string): ParsedChat {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')

  type Pending = { header: RawLine; body: string[]; lrm: boolean }
  const pending: Pending[] = []
  for (const original of lines) {
    const line = original.replace(INVISIBLE, '').replace(/\u202f|\u00a0/g, ' ')
    const header = matchHeader(line)
    if (header) {
      // No iPhone, avisos do sistema e mídias começam com uma marca invisível logo depois de "Autor: "
      pending.push({ header, body: [header.rest], lrm: original.includes(': ' + '\u200e') })
    } else if (pending.length > 0) {
      pending[pending.length - 1].body.push(line)
    }
  }

  const dayFirst = detectDayFirst(pending.map((p) => p.header))
  const messages: Message[] = []
  const authorCount = new Map<string, number>()
  let groupName: string | undefined

  for (const { header, body, lrm } of pending) {
    const day = dayFirst ? header.a : header.b
    const month = dayFirst ? header.b : header.a
    const ts = new Date(header.year, month - 1, day, header.hour, header.minute, header.second).getTime()
    if (Number.isNaN(ts)) continue

    const full = body.join('\n')
    const { author, text: rawText } = splitAuthor(full)
    let text = rawText
    let edited = false
    if (EDITED.test(text)) {
      edited = true
      text = text.replace(EDITED, '')
    }
    let kind: MessageKind = author === null ? 'system' : classify(text)
    let who = author
    if (
      kind === 'text' &&
      (ENCRYPTION.test(full) || (lrm && SYSTEM_TEXT.test(text.trim())) || /^.{1,80} (?:criou o grupo|mudou o nome de|mudou o assunto de) [“"]/.test(full))
    ) {
      kind = 'system'
      who = null
    }
    if (kind === 'system') {
      const named = GROUP_NAME.exec(full.trim())
      if (named) groupName = named[1].trim()
    }
    const file = kind !== 'text' && kind !== 'system' ? attachmentName(text) : undefined
    messages.push({ ts, author: who, text: text.trim(), kind, edited, ...(file ? { file } : {}) })
    if (who !== null) authorCount.set(who, (authorCount.get(who) ?? 0) + 1)
  }

  messages.sort((x, y) => x.ts - y.ts)
  const authors = [...authorCount.entries()].sort((x, y) => y[1] - x[1]).map(([name]) => name)
  return { messages, authors, groupName }
}

/** Tenta tirar o nome do grupo do nome do arquivo exportado. */
export function groupNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.(txt|zip)$/i, '').trim()
  const patterns = [
    /^Conversa do WhatsApp com (.+)$/i,
    /^WhatsApp Chat (?:with|-|com) (.+)$/i,
    /^Conversa (?:com|do) (.+)$/i,
  ]
  for (const re of patterns) {
    const m = re.exec(base)
    if (m) return m[1].replace(/\s*\(\d+\)$/, '').trim()
  }
  if (/^_?chat$/i.test(base)) return 'Nosso grupo'
  return base
}

export function looksLikePhone(name: string): boolean {
  return /^\+?[\d\s().-]{8,}$/.test(name.replace(INVISIBLE, ''))
}

export function maskPhone(name: string): string {
  const digits = name.replace(/\D/g, '')
  return `Contato ••${digits.slice(-4)}`
}
