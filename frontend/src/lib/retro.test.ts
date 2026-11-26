import { describe, expect, it } from 'vitest'
import { attachmentName, captionOf, classify, groupNameFromFile, parseChat } from './parser'
import { availablePeriods, computeRetro, customPeriod, funnyMoments, periodKind, stripForShare } from './stats'
import { laughType, emojis } from './text'
import { generateSampleChat } from './sample'
import { decodeRetro, encodeRetro } from './share'
import { holidayName } from './holidays'
import { THEMES, pickTopic } from './topics'
import { extractChatFromZip } from './zip'
import { seal, toBase64Url, unseal, vaultLinkFromHash } from './vault'

describe('parser', () => {
  it('lê o formato do Android em português', () => {
    const chat = parseChat(
      [
        '01/02/2026 09:15 - Fulano criou o grupo "Galera"',
        '01/02/2026 09:16 - Bia: bom dia',
        'segunda linha',
        '01/02/2026 09:17 - Léo: <Mídia oculta>',
        '01/02/2026 09:18 - Léo: STK-20260201-WA0001.webp (arquivo anexado)',
        '01/02/2026 09:19 - Bia: Mensagem apagada',
        '01/02/2026 21:05 - Bia: oi <Mensagem editada>',
      ].join('\n'),
    )
    expect(chat.messages).toHaveLength(6)
    expect(chat.messages[0].kind).toBe('system')
    expect(chat.messages[1]).toMatchObject({ author: 'Bia', text: 'bom dia\nsegunda linha', kind: 'text' })
    expect(chat.messages[2].kind).toBe('media')
    expect(chat.messages[3].kind).toBe('sticker')
    expect(chat.messages[4].kind).toBe('deleted')
    expect(chat.messages[5]).toMatchObject({ text: 'oi', edited: true })
    expect(new Date(chat.messages[5].ts).getHours()).toBe(21)
    expect(chat.authors).toEqual(['Bia', 'Léo'])
  })

  it('lê o formato do iPhone com caracteres invisíveis', () => {
    const chat = parseChat(
      [
        '[14/11/2026, 13:45:12] Grupo: \u200eAs mensagens são protegidas',
        '[14/11/2026, 13:46:00] Bia: \u200efigurinha omitida',
        '\u200e[14/11/2026, 13:47:30] Rafa: \u200eáudio ocultado',
        '[14/11/2026, 13:48:00] Rafa: \u200e<anexado: 00000012-PHOTO-2026-11-14-13-48-00.jpg>',
      ].join('\n'),
    )
    expect(chat.messages.map((m) => m.kind)).toEqual(['text', 'sticker', 'audio', 'image'])
  })

  it('ignora avisos do sistema que chegam com cara de mensagem', () => {
    const chat = parseChat(
      [
        // iPhone: o "autor" é o nome do grupo e o texto começa com a marca invisível
        '[01/02/2026, 09:00:00] Galera: LRMAs mensagens e as ligações são protegidas com a criptografia de ponta a ponta.',
        '[01/02/2026, 09:00:01] Galera: LRMBia criou o grupo “Galera”',
        '[01/02/2026, 09:00:02] Galera: LRMBia adicionou Léo',
        '[01/02/2026, 09:01:00] Bia: oi gente',
        '[01/02/2026, 09:02:00] Léo: LRMfigurinha omitida',
        // Mensagem de verdade que fala de "adicionou" não pode sumir
        '[01/02/2026, 09:03:00] Léo: o rafa adicionou a gente no outro grupo',
        // Android com ": " no nome do grupo
        '01/02/2026 09:04 - Bia mudou o nome de "Galera" para "Galera: 2026"',
        '01/02/2026 09:05 - Bia criou o grupo "Rolê: sábado"',
      ]
        .join('\n')
        .replaceAll('LRM', '\u200e'),
    )
    const real = chat.messages.filter((m) => m.author !== null)
    expect(real.map((m) => m.text)).toEqual(['oi gente', 'figurinha omitida', 'o rafa adicionou a gente no outro grupo'])
    expect(chat.authors).toEqual(['Léo', 'Bia'])
    // O nome do grupo sai do último aviso de criação/troca de nome
    expect(chat.groupName).toBe('Rolê: sábado')
  })

  it('entende mês/dia em inglês com AM/PM', () => {
    const chat = parseChat(['11/14/26, 1:45\u202fPM - Ann: hi', '11/15/26, 12:05 AM - Bob: <Media omitted>'].join('\n'))
    const d = new Date(chat.messages[0].ts)
    expect([d.getMonth(), d.getDate(), d.getHours()]).toEqual([10, 14, 13])
    expect(new Date(chat.messages[1].ts).getHours()).toBe(0)
    expect(chat.messages[1].kind).toBe('media')
  })

  it('classifica anexos pelo nome do arquivo', () => {
    expect(classify('PTT-20260101-WA0001.opus (arquivo anexado)')).toBe('audio')
    expect(classify('VID-20260101-WA0001.mp4 (arquivo anexado)')).toBe('video')
    expect(classify('IMG-20260101-WA0001.jpg (arquivo anexado)')).toBe('image')
    expect(classify('ENQUETE:\nOnde?')).toBe('poll')
    expect(attachmentName('legenda <anexado: 00000123-STICKER-2026.webp>')).toBe('00000123-STICKER-2026.webp')
    expect(attachmentName('STK-20260101-WA0001.webp (arquivo anexado)')).toBe('STK-20260101-WA0001.webp')
    expect(captionOf('olha isso <anexado: 00000123-PHOTO-2026.jpg>')).toBe('olha isso')
    expect(captionOf('<anexado: 00000123-PHOTO-2026.jpg>')).toBeUndefined()
    expect(captionOf('figurinha omitida')).toBeUndefined()
    // Foto com legenda no iPhone: a legenda vem antes do anexo
    expect(classify('olha isso aqui <anexado: 00000123-PHOTO-2026-03-01-10-00-00.jpg>')).toBe('image')
    expect(classify('look <attached: 00000124-VIDEO-2026-03-01-10-00-00.mp4>')).toBe('video')
  })

  it('tira o nome do grupo do arquivo', () => {
    expect(groupNameFromFile('Conversa do WhatsApp com Galera da Facul.txt')).toBe('Galera da Facul')
    expect(groupNameFromFile('WhatsApp Chat - Família.zip')).toBe('Família')
  })
})

describe('texto', () => {
  it('reconhece risadas', () => {
    expect(laughType('kkkkk')).toBe('kkk')
    expect(laughType('KKKKJ')).toBe('kkk')
    expect(laughType('hahaha')).toBe('haha')
    expect(laughType('rs')).toBe('rsrs')
    expect(laughType('RS')).toBeNull()
    expect(laughType('huehuehue')).toBe('huehue')
    expect(laughType('huahaha')).toBe('haha')
    expect(laughType('huahuahua')).toBe('haha')
    expect(laughType('hum')).toBeNull()
    expect(laughType('ksksks')).toBe('ksks')
    expect(laughType('k')).toBeNull()
    expect(laughType('casa')).toBeNull()
  })

  it('conta emojis juntando tons de pele', () => {
    expect(emojis('oi 👍🏽👍 ❤️ ❤ 🇧🇷')).toEqual(['👍', '👍', '❤\ufe0f', '❤\ufe0f', '🇧🇷'])
  })
})

describe('temas', () => {
  const base = THEMES.map(() => 0.86)
  it('escolhe o tema que se destaca da conversa de sempre', () => {
    const scores = base.map((b, i) => (THEMES[i].label === 'Futebol' ? b + 0.03 : b + (i % 3) * 0.001))
    expect(pickTopic(scores, base)).toBe('⚽ Futebol')
  })
  it('mostra dois temas quando os dois se destacam', () => {
    const scores = base.map((b, i) => (['Série e filme', 'Trabalho'].includes(THEMES[i].label) ? b + 0.03 : b))
    expect(pickTopic(scores, base)).toMatch(/Série e filme · .*Trabalho|Trabalho · .*Série e filme/)
  })
  it('exige que o tema apareça no texto', () => {
    const scores = base.map((b, i) => (THEMES[i].label === 'Clima' ? b + 0.03 : b + (i % 3) * 0.001))
    expect(pickTopic(scores, base, { text: 'bora pegar o ingresso, chego daqui a pouco', min: 3 })).toBeNull()
    expect(pickTopic(scores, base, { text: 'que chuva, frio demais, a previsão do tempo errou de novo', min: 3 })).toBe('🌧️ Clima')
  })
  it('não chuta quando nada se destaca', () => {
    const scores = base.map((b, i) => b + (i % 5) * 0.002)
    expect(pickTopic(scores, base)).toBeNull()
  })
})

describe('datas comemorativas', () => {
  it('acha feriados fixos e móveis', () => {
    expect(holidayName(new Date(2026, 11, 25).getTime())).toBe('Natal')
    expect(holidayName(new Date(2026, 1, 17).getTime())).toBe('Carnaval') // Páscoa de 2026 é 5/4
    expect(holidayName(new Date(2026, 3, 5).getTime())).toBe('Páscoa')
    expect(holidayName(new Date(2026, 4, 10).getTime())).toBe('Dia das Mães')
    expect(holidayName(new Date(2026, 7, 9).getTime())).toBe('Dia dos Pais')
    expect(holidayName(new Date(2026, 2, 3).getTime())).toBeNull()
    expect(holidayName(new Date(2026, 9, 4).getTime())).toBe('Eleição (1º turno)')
    expect(holidayName(new Date(2026, 9, 25).getTime())).toBe('Eleição (2º turno)')
    expect(holidayName(new Date(2027, 9, 3).getTime())).toBeNull() // ano ímpar não tem eleição
  })
})

describe('retrospectiva', () => {
  const chat = parseChat(generateSampleChat(2026, new Date(2026, 10, 14)))
  const periods = availablePeriods(chat.messages)
  const retro = computeRetro(chat.messages, 'Exemplo', periods[0])

  it('calcula totais coerentes', () => {
    expect(periods[0].label).toBe('2026')
    expect(retro.totals.messages).toBe(retro.people.reduce((a, p) => a + p.messages, 0))
    expect(retro.people[0].name).toBe('Bia Andrade')
    expect(retro.heat.reduce((a, b) => a + b, 0)).toBe(retro.totals.messages)
    // Ano em curso: só os meses que já tiveram conversa (jan a nov no exemplo)
    expect(retro.months).toHaveLength(11)
    expect(retro.mediaTyped).toBe(true)
  })

  it('acha o silêncio das férias e o dia mais movimentado', () => {
    expect(retro.silence!.ms).toBeGreaterThan(7 * 86_400_000)
    expect(retro.topDays).toHaveLength(3)
    const newYear = retro.topDays[0]
    expect(new Date(newYear.ts).getMonth()).toBe(0)
    expect(newYear.holiday).toBe('Ano Novo')
    expect(newYear.words).toEqual(expect.arrayContaining(['feliz']))
    expect(newYear.count).toBeGreaterThan(retro.topDays[1].count)
    expect(retro.totals.polls).toBe(1)
  })

  it('guarda números por pessoa para a retrospectiva individual', () => {
    const bia = retro.people[0]
    expect(bia.months).toHaveLength(retro.months.length)
    expect(bia.months.reduce((a, b) => a + b, 0)).toBe(bia.messages)
    expect(bia.week.reduce((a, b) => a + b, 0)).toBe(bia.messages)
    expect(bia.activeDays).toBeGreaterThan(100)
    expect(bia.busiestDay!.count).toBeGreaterThan(10)
  })

  it('dá um título diferente para cada pessoa', () => {
    expect(retro.awards).toHaveLength(retro.people.length)
    expect(new Set(retro.awards.map((a) => a.id)).size).toBe(retro.awards.length)
    const byName = Object.fromEntries(retro.awards.map((a) => [retro.people[a.person].name, a.id]))
    expect(byName['Rafa']).toBe('podcast')
    expect(byName['Duda']).toBe('figurinha')
    expect(byName['Léo']).toBe('coruja')
    expect(byName['+55 11 98765-4321']).toBe('fantasma')
  })

  it('acha o momento mais engraçado pela onda de risadas', () => {
    const lines = [
      '10/03/2026 20:00 - Ana: alguém viu o jogo?',
      '10/03/2026 20:01 - Beto: vi sim',
      '10/03/2026 20:02 - Caio: o juiz escorregou e caiu sentado na bola',
      '10/03/2026 20:02 - Ana: KKKKKKKKKKKKK',
      '10/03/2026 20:03 - Beto: kkkkkkk não acredito',
      '10/03/2026 20:03 - Duda: KKKKKKKKKKKKKKKKKKK morri',
      '10/03/2026 20:04 - Ana: hahahaha',
      '11/03/2026 09:00 - Beto: bom dia',
      '11/03/2026 09:01 - Ana: kkk bom dia',
    ]
    const c = parseChat(lines.join('\n'))
    const r = computeRetro(c.messages, 'x', availablePeriods(c.messages)[0])
    const geral = r.funnies.find((f) => f.category === 'geral')!.moment
    expect(geral.bubbles[geral.trigger].text).toContain('juiz escorregou')
    expect(geral.laughers).toBe(3)
    // Quem fez rir e quem riu, por pessoa
    const caio = r.people.find((p) => p.name === 'Caio')!
    expect(caio.funny?.bubbles[caio.funny.trigger].text).toContain('juiz')
    expect(caio.laughedBy.length).toBeGreaterThanOrEqual(3)
    expect(r.people.find((p) => p.name === 'Ana')!.laughedAt[0][0]).toBe(r.people.indexOf(caio))
    expect(stripForShare(r, { excerpts: false, words: true }).funnies).toEqual([])
    expect(stripForShare(r, { excerpts: false, words: true }).excerpts).toBe(false)
    // Com trechos, vai só o momento escolhido, sem as outras opções
    const withExcerpts = stripForShare(r, { excerpts: true, words: true })
    expect(withExcerpts.funnies[0].options).toBeUndefined()
    expect(withExcerpts.funnies[0].moment.bubbles.length).toBeGreaterThan(0)
  })

  it('compara critérios de momento engraçado', () => {
    const lines = [
      // Figurinha que faz rir, mas a conversa segue normal logo depois
      '10/03/2026 20:00 - Ana: STK-20260310-WA0001.webp (arquivo anexado)',
      '10/03/2026 20:01 - Beto: kkk',
      '10/03/2026 20:01 - Caio: kk',
      '10/03/2026 20:02 - Duda: kkk',
      '10/03/2026 20:02 - Beto: mas e aí, vamos sábado?',
      '10/03/2026 20:03 - Caio: vamos sim',
      '10/03/2026 20:03 - Duda: que horas?',
      // Piada escrita com uma onda de risadas de verdade
      '12/03/2026 21:00 - Caio: o juiz escorregou e caiu sentado na bola',
      '12/03/2026 21:00 - Ana: KKKKKKKKKKKKKKKK',
      '12/03/2026 21:01 - Beto: KKKKKKKKKKKKK',
      '12/03/2026 21:01 - Duda: kkkkkkkkkkk morri',
      '12/03/2026 21:01 - Ana: chorando kkkkkk',
    ]
    const c = parseChat(lines.join('\n'))
    const idx = new Map(['Ana', 'Beto', 'Caio', 'Duda'].map((n, i) => [n, i]))
    const msgs = c.messages.filter((m) => m.author)
    const pura = funnyMoments(msgs, idx, 4, 'pura', 2)
    expect(pura[0].bubbles[pura[0].trigger].text).toContain('juiz')
    expect(pura[0].purity).toBe(1)
    // A figurinha guarda o nome do arquivo para buscar a imagem no zip
    const sticker = funnyMoments(msgs, idx, 4, 'pessoas', 2).flatMap((m) => m.bubbles).find((b) => b.kind === 'sticker')
    expect(sticker?.file).toBe('STK-20260310-WA0001.webp')
    expect(funnyMoments(msgs, idx, 4, 'texto', 3).every((m) => m.bubbles[m.trigger].kind === 'text')).toBe(true)
    // Melhor figurinha, separada do geral
    const stickerOnly = funnyMoments(msgs, idx, 4, 'pura', 1, 'sticker')[0]
    expect(stickerOnly.bubbles[stickerOnly.trigger].kind).toBe('sticker')
  })

  it('encontra bordões', () => {
    const rafa = retro.people.find((p) => p.name === 'Rafa')!
    expect(rafa.catchphrases).toEqual(expect.arrayContaining(['bora']))
  })

  it('o link compartilhado volta igual e sem trechos quando pedido', async () => {
    const shared = stripForShare(retro, { excerpts: false, words: true })
    expect(shared.first?.text).toBeUndefined()
    expect(shared.longTexts.length).toBeGreaterThan(0)
    expect(JSON.stringify(shared.longTexts)).not.toContain('text')
    expect(stripForShare(retro, { excerpts: false, words: false }).topDays[0].words).toBeUndefined()
    const payload = await encodeRetro(shared)
    expect(payload.length).toBeLessThan(12_000)
    expect(await decodeRetro(payload)).toEqual(shared)
  })
})

describe('período personalizado', () => {
  it('calcula só o intervalo escolhido', () => {
    const chat = parseChat(generateSampleChat(2026, new Date(2026, 10, 14)))
    const p = customPeriod('2026-03-01', '2026-05-31')
    expect(p.label).toBe('01/03 a 31/05/2026')
    const r = computeRetro(chat.messages, 'x', p)
    expect(periodKind(r)).toBe('custom')
    expect(r.months.map((m) => m.label)).toEqual(['mar', 'abr', 'mai'])
    const inRange = chat.messages.filter((m) => m.author && m.ts >= p.start && m.ts < p.end).length
    expect(r.totals.messages).toBe(inRange)
  })

  it('atravessa a virada do ano com os meses em ordem', () => {
    const text = [generateSampleChat(2025, new Date(2025, 11, 31)), generateSampleChat(2026, new Date(2026, 10, 14))].join('\n')
    const chat = parseChat(text)
    const p = customPeriod('2025-11-15', '2026-02-10')
    expect(p.label).toBe('15/11/2025 a 10/02/2026')
    const r = computeRetro(chat.messages, 'x', p)
    expect(r.months.map((m) => m.label)).toEqual(['nov/25', 'dez/25', 'jan/26', 'fev/26'])
    expect(r.months.reduce((a, m) => a + m.count, 0)).toBe(r.totals.messages)
  })
})

describe('cofre', () => {
  it('criptografa e abre de volta só com a chave certa', async () => {
    const chat = parseChat(generateSampleChat(2026, new Date(2026, 10, 14)))
    const r = computeRetro(chat.messages, 'Exemplo', availablePeriods(chat.messages)[0])
    const { packet, key } = await seal(r)
    expect(new TextDecoder().decode(packet)).not.toContain('Exemplo') // nada legível no pacote
    expect(await unseal(packet, key)).toEqual(r)
    const wrong = crypto.getRandomValues(new Uint8Array(32))
    await expect(unseal(packet, wrong)).rejects.toThrow()
  })

  it('lê o link do cofre', () => {
    const key = crypto.getRandomValues(new Uint8Array(32))
    const link = vaultLinkFromHash(`#c=7FUUi5-FvWnP_rAmmhq41Q.${toBase64Url(key)}`)
    expect(link?.id).toBe('7FUUi5-FvWnP_rAmmhq41Q')
    expect(link?.key).toEqual(key)
    expect(vaultLinkFromHash('#r=abc')).toBeNull()
  })
})

describe('zip', () => {
  it('extrai o .txt de um zip deflate', async () => {
    const text = 'linha 1\nlinha 2 com acentuação 😂\n'.repeat(50)
    const zip = await makeZip('_chat.txt', new TextEncoder().encode(text))
    expect(await extractChatFromZip(zip)).toBe(text)
  })
})

// Monta um zip de uma entrada com deflate, só para teste
async function makeZip(name: string, data: Uint8Array): Promise<Blob> {
  const comp = new Uint8Array(
    await new Response(new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(),
  )
  const nameBytes = new TextEncoder().encode(name)
  const local = new DataView(new ArrayBuffer(30))
  local.setUint32(0, 0x04034b50, true)
  local.setUint16(8, 8, true)
  local.setUint32(18, comp.length, true)
  local.setUint32(22, data.length, true)
  local.setUint16(26, nameBytes.length, true)
  const cdOffset = 30 + nameBytes.length + comp.length
  const cd = new DataView(new ArrayBuffer(46))
  cd.setUint32(0, 0x02014b50, true)
  cd.setUint16(10, 8, true)
  cd.setUint32(20, comp.length, true)
  cd.setUint32(24, data.length, true)
  cd.setUint16(28, nameBytes.length, true)
  cd.setUint32(42, 0, true)
  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, 0x06054b50, true)
  eocd.setUint16(8, 1, true)
  eocd.setUint16(10, 1, true)
  eocd.setUint32(12, 46 + nameBytes.length, true)
  eocd.setUint32(16, cdOffset, true)
  return new Blob([local, nameBytes, comp, cd, nameBytes, eocd] as BlobPart[])
}
