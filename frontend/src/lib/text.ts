export type LaughType = 'kkk' | 'haha' | 'rsrs' | 'hehe' | 'huehue' | 'ksks'

export const LAUGH_LABEL: Record<LaughType, string> = {
  kkk: 'kkkk',
  haha: 'hahaha',
  rsrs: 'rsrs',
  hehe: 'hehe',
  huehue: 'huehue',
  ksks: 'ksksks',
}

const WORD = /[\p{L}\p{N}]+/gu

export function tokens(text: string): string[] {
  return text.match(WORD) ?? []
}

export function laughType(token: string): LaughType | null {
  const t = token.toLowerCase()
  if (t.length >= 2 && /^k[kj]*$/.test(t) && (t.match(/k/g)?.length ?? 0) >= 2) return 'kkk'
  if (/^a?(?:h+a+){2,}h*$/.test(t) || /^a?(?:h+u+a+){1,}(?:h+u*a+)+h*$/.test(t)) return 'haha'
  if (/^(?:h+u+e+){2,}h*$/.test(t)) return 'huehue'
  if (/^(?:h+e+){2,}h*$/.test(t)) return 'hehe'
  if (t.length >= 4 && (/^(?:k+s+){2,}k*$/.test(t) || /^(?:s+k+){2,}s*$/.test(t))) return 'ksks'
  // "rs" sozinho é risada, mas "RS" em maiúsculas pode ser o estado
  if (/^(?:r+s+)+r*$/.test(t) && (token !== token.toUpperCase() || t.length >= 4)) return 'rsrs'
  return null
}

const segmenter = new Intl.Segmenter('pt', { granularity: 'grapheme' })
const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u
const SKIN_TONE = /[\u{1F3FB}-\u{1F3FF}]/gu

export function emojis(text: string): string[] {
  if (!PICTO.test(text)) return []
  const out: string[] = []
  for (const { segment } of segmenter.segment(text)) {
    if (!PICTO.test(segment)) continue
    // Junta variações (tom de pele, seletor de estilo) e devolve o seletor
    // colorido aos símbolos antigos, senão o ❤️ vira um ❤ preto
    const base = segment.replace(SKIN_TONE, '').replace(/\ufe0f/g, '')
    const single = [...base]
    out.push(single.length === 1 && single[0].codePointAt(0)! < 0x1f000 ? base + '\ufe0f' : base)
  }
  return out
}

export function isCaps(laughFree: string[]): boolean {
  const letters = laughFree.join('').replace(/[^\p{L}]/gu, '')
  return letters.length >= 6 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()
}

export const URL_RE = /https?:\/\/[^\s<>"]+/gi

export function domainOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\.|^m\.|^mobile\./, '')
    if (/(^|\.)youtu(\.be|be\.com)$/.test(host)) return 'youtube.com'
    if (host === 'vm.tiktok.com' || host.endsWith('tiktok.com')) return 'tiktok.com'
    if (host === 'x.com' || host.endsWith('twitter.com')) return 'x.com'
    if (host.endsWith('instagram.com')) return 'instagram.com'
    if (host === 'open.spotify.com' || host.endsWith('spotify.com') || host === 'spotify.link') return 'spotify.com'
    if (host.includes('maps.google') || host === 'maps.app.goo.gl') return 'maps'
    return host
  } catch {
    return null
  }
}

// Palavras que não servem como bordão
export const STOPWORDS = new Set(
  `a à ao aos as às o os um uma uns umas de do da dos das no na nos nas num numa em por pelo pela pelos pelas
  para pra pro pros pras com sem sob sobre entre até após e ou mas nem que se porque pq por que quê como quando
  onde quem qual quais quanto quanta quantos quantas eu tu ele ela nós vós eles elas você vocês vc vcs voce me
  te se nos lhe lhes meu minha meus minhas teu tua teus tuas seu sua seus suas nosso nossa nossos nossas dele
  dela deles delas isso isto aquilo esse essa esses essas este esta estes estas aquele aquela aqueles aquelas
  aqui ali lá la cá ai aí já ja não nao n sim s é e eh era foi ser sou são sao está esta tá ta to tô tou estou
  estão tao tão estava tem têm tinha ter tenho temos vai vou vamos ir fui foi faz fazer fiz feito ser seria
  muito muita muitos muitas mais menos bem mal só so também tambem ainda agora depois antes hoje ontem amanhã
  então entao tipo assim aí todo toda todos todas tudo nada algo alguém ninguém cada outro outra outros outras
  mesmo mesma mesmos mesmas pode posso podia vem vai deu dá da dar ver vi viu ne né nem kd cadê q oq o que
  the and you that this for with have was are not but just like what all can will get your one out about
  mídia oculta midia imagem ocultada omitida omitido áudio audio vídeo video figurinha sticker arquivo anexado
  mensagem apagada editada http https www com br jpg webp opus mp4 null
  qnd qdo msm dps tbm tb mto mt mts gnt hj agr td tds ngm cmg ctg vdd pfv pfvr obg vlw blz cd pdc dnv ent entt`.split(/\s+/),
)

const deaccent = (w: string) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const STOPWORDS_PLAIN = new Set([...STOPWORDS].map(deaccent))

/** Palavra vazia, com ou sem acento ("alguém" e "alguem" valem igual). */
export function isStopword(w: string): boolean {
  return STOPWORDS.has(w) || STOPWORDS_PLAIN.has(deaccent(w))
}
