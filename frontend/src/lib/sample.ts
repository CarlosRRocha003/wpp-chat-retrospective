/**
 * Gera uma conversa fictícia no formato de export do Android,
 * para o botão "ver um exemplo" e para os testes.
 */

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Persona {
  name: string
  weight: number
  night: number // chance de estar acordado de madrugada
  audio: number
  sticker: number
  photo: number
  laugh: string[]
  laughRate: number
  long: number
  question: number
  caps: number
  slang: string[]
}

const PERSONAS: Persona[] = [
  { name: 'Bia Andrade', weight: 9, night: 0.05, audio: 0.02, sticker: 0.05, photo: 0.06, laugh: ['kkkkk', 'kkkkkkkk', 'KKKKKKKKK'], laughRate: 0.35, long: 0.05, question: 0.12, caps: 0.03, slang: ['amiga', 'socorro', 'gente'] },
  { name: 'Léo', weight: 7, night: 0.35, audio: 0.01, sticker: 0.04, photo: 0.03, laugh: ['kkkk', 'kkk'], laughRate: 0.2, long: 0.02, question: 0.08, caps: 0.02, slang: ['mano', 'slk', 'pior'] },
  { name: 'Rafa', weight: 6, night: 0.04, audio: 0.25, sticker: 0.02, photo: 0.04, laugh: ['hahaha', 'hahahaha'], laughRate: 0.15, long: 0.03, question: 0.1, caps: 0.01, slang: ['bora', 'partiu', 'suave'] },
  { name: 'Duda', weight: 5, night: 0.08, audio: 0.02, sticker: 0.35, photo: 0.05, laugh: ['ksksksks', 'kkkk'], laughRate: 0.25, long: 0.01, question: 0.05, caps: 0.12, slang: ['real', 'oxe', 'eita'] },
  { name: 'Nanda', weight: 4, night: 0.03, audio: 0.03, sticker: 0.03, photo: 0.18, laugh: ['rsrs', 'rsrsrs'], laughRate: 0.15, long: 0.25, question: 0.15, caps: 0.0, slang: ['inclusive', 'enfim', 'aliás'] },
  { name: '+55 11 98765-4321', weight: 0.4, night: 0.02, audio: 0.0, sticker: 0.05, photo: 0.05, laugh: ['kk'], laughRate: 0.1, long: 0.0, question: 0.2, caps: 0.0, slang: ['opa'] },
]

const LINES = [
  'alguém vai no rolê sábado',
  'cheguei em casa agora',
  'vocês viram o jogo ontem',
  'to morrendo de sono',
  'que dia longo meu deus',
  'bora marcar alguma coisa',
  'eu avisei',
  'não acredito nisso',
  'faz sentido',
  'manda a foto aí',
  'acabei de acordar',
  'quem topa um churrasco',
  'to saindo do trabalho',
  'esse filme é muito bom',
  'preciso de férias urgente',
  'vou ver e te falo',
  'tá chovendo aí também',
  'isso aqui é muito a cara de vocês',
  'calma que eu já chego',
  'fechou então',
  'que saudade de vocês',
  'alguém tem indicação de série',
  'perdi o ônibus de novo',
  'gente que fome',
  'hoje é dia de pizza',
  'olha isso',
  'concordo demais',
  'pelo amor',
  'tô passando mal com isso',
  'amanhã cedo eu vejo',
]

const QUESTIONS = [
  'que horas vai ser?',
  'alguém sabe onde fica?',
  'quem vai levar o carvão?',
  'vocês já jantaram?',
  'qual é o plano?',
  'alguém acordado?',
  'bora ou não bora?',
  'onde vocês estão?',
]

const LONGS = [
  'então gente, pensei melhor sobre a viagem e acho que a gente devia ir de carro porque sai mais barato dividindo a gasolina, dá pra parar no caminho pra comer naquele lugar que a gente gostou da outra vez e ainda volta na hora que quiser sem depender de horário de ônibus',
  'só pra registrar que eu falei desde o começo que isso ia dar errado, mas ninguém me escuta nesse grupo, aí quando acontece todo mundo finge que não sabia, enfim, sigo aqui sendo a voz da razão',
  'resumo do dia: acordei atrasada, o metrô parou, cheguei no trabalho e a reunião tinha sido cancelada, almocei correndo, e agora descobri que amanhã tem outra reunião às oito da manhã. alguém me resgata',
]

const LINKS = [
  'https://www.youtube.com/watch?v=abc123',
  'https://youtu.be/xyz789',
  'https://www.instagram.com/p/C0abc/',
  'https://vm.tiktok.com/ZMabc/',
  'https://open.spotify.com/track/123',
  'https://g1.globo.com/noticia',
]

const EMOJIS = ['😂', '🤣', '😭', '❤️', '🙏', '🔥', '👀', '😍', '💀', '🥲', '👍', '🍕']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function generateSampleChat(year = new Date().getFullYear(), until = new Date()): string {
  const rand = rng(year * 31 + 7)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const out: string[] = []
  const counters = { STK: 1, PTT: 1, IMG: 1, VID: 1 }

  const stamp = (d: Date) =>
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`

  out.push(`01/01/${year} 00:00 - As mensagens e ligações são protegidas com a criptografia de ponta a ponta.`)

  const pickPersona = (hour: number) => {
    const weights = PERSONAS.map((p) => (hour < 5 ? p.weight * p.night : p.weight))
    let r = rand() * weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < PERSONAS.length; i++) {
      r -= weights[i]
      if (r <= 0) return PERSONAS[i]
    }
    return PERSONAS[0]
  }

  const end = until.getFullYear() === year ? until : new Date(year, 11, 31, 23, 59)
  // Uma semana de silêncio em julho, pra ter o "maior silêncio"
  const vacationStart = new Date(year, 6, 8).getTime()
  const vacationEnd = new Date(year, 6, 17).getTime()

  for (let day = new Date(year, 0, 1); day <= end; day.setDate(day.getDate() + 1)) {
    if (day.getTime() >= vacationStart && day.getTime() < vacationEnd) continue
    const weekend = day.getDay() === 0 || day.getDay() === 6
    const special = day.getMonth() === 0 && day.getDate() === 1 // ano novo bombando
    const sessions = special ? 8 : Math.floor(rand() * (weekend ? 5 : 3)) + (rand() < 0.08 ? 0 : 1)

    for (let s = 0; s < sessions; s++) {
      const hourRoll = rand()
      const hour = special && s === 0 ? 0 : hourRoll < 0.06 ? Math.floor(rand() * 4) + 1 : Math.floor(8 + rand() * 15)
      const t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, Math.floor(rand() * 60))
      const size = special ? 60 : Math.floor(rand() * 18) + 3
      let author = pickPersona(hour)

      for (let k = 0; k < size; k++) {
        if (t > end) break
        if (k > 0 && rand() < 0.7) author = pickPersona(t.getHours())
        const head = `${stamp(t)} - ${author.name}: `
        const r = rand()
        let body: string
        if (special && k < 20) body = pick(['FELIZ ANO NOVO', 'feliz ano novo gente ❤️', `que ${year} seja leve 🙏`, 'FELIZ ANO NOVOOOO 🎉'])
        else if (r < author.audio) body = `PTT-${year}${pad(t.getMonth() + 1)}${pad(t.getDate())}-WA${String(counters.PTT++).padStart(4, '0')}.opus (arquivo anexado)`
        else if (r < author.audio + author.sticker) body = `STK-${year}${pad(t.getMonth() + 1)}${pad(t.getDate())}-WA${String(counters.STK++).padStart(4, '0')}.webp (arquivo anexado)`
        else if (r < author.audio + author.sticker + author.photo)
          body =
            rand() < 0.8
              ? `IMG-${year}${pad(t.getMonth() + 1)}${pad(t.getDate())}-WA${String(counters.IMG++).padStart(4, '0')}.jpg (arquivo anexado)`
              : `VID-${year}${pad(t.getMonth() + 1)}${pad(t.getDate())}-WA${String(counters.VID++).padStart(4, '0')}.mp4 (arquivo anexado)`
        else if (rand() < 0.012) body = 'Mensagem apagada'
        else if (rand() < 0.015) body = pick(LINKS)
        else if (rand() < author.long * 0.3) body = pick(LONGS)
        else if (rand() < author.question) body = pick(QUESTIONS)
        else if (rand() < author.laughRate) body = pick(author.laugh) + (rand() < 0.3 ? ' ' + pick(LINES) : '')
        else {
          body = pick(LINES)
          if (rand() < 0.3) body = `${pick(author.slang)} ${body}`
          if (rand() < 0.2) body += ` ${pick(author.slang)}`
          if (rand() < author.caps) body = body.toUpperCase()
          if (rand() < 0.25) body += ' ' + pick(EMOJIS) + (rand() < 0.4 ? pick(EMOJIS) : '')
          if (rand() < 0.01) body += ' <Mensagem editada>'
        }
        out.push(head + body)
        t.setSeconds(t.getSeconds() + Math.floor(5 + rand() * (rand() < 0.1 ? 1800 : 150)))
      }
    }
  }
  if (year === 2026 || rand() < 2) {
    out.push(`15/03/${year} 14:02 - Rafa: ENQUETE:\nOnde vai ser o aniversário?\nOPÇÃO: Bar do Zé (3 votos)\nOPÇÃO: Casa da Bia (2 votos)`)
  }
  return out.join('\n')
}
