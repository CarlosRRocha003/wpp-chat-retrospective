// Temas para descobrir o assunto de um dia (ou de um textão) com um modelo de similaridade.
// O modelo compara o texto com a descrição de cada tema; não escreve nada, só escolhe.

export interface Theme {
  emoji: string
  label: string
  hint: string
}

export const THEMES: Theme[] = [
  { emoji: '🎂', label: 'Aniversário e festa', hint: 'aniversário, parabéns, bolo, presente, surpresa, comemoração, vaquinha' },
  { emoji: '⚽', label: 'Futebol', hint: 'futebol, jogo, gol, time, juiz, campeonato, partida, seleção, pênalti' },
  { emoji: '✈️', label: 'Viagem', hint: 'viagem, praia, passeio, hospedagem, airbnb, estrada, feriado, mala, hotel' },
  { emoji: '🔥', label: 'Briga ou discussão', hint: 'briga, discussão, treta, reclamação, desculpa, chateado, furou, culpa' },
  { emoji: '💼', label: 'Trabalho', hint: 'trabalho, reunião, chefe, emprego, escritório, projeto, salário, entrevista' },
  { emoji: '🎬', label: 'Série e filme', hint: 'série, filme, episódio, netflix, spoiler, cinema, temporada, assistir' },
  { emoji: '🍕', label: 'Comida', hint: 'comida, almoço, jantar, restaurante, pizza, receita, ifood, fome' },
  { emoji: '🗳️', label: 'Política', hint: 'política, eleição, governo, presidente, voto, candidato, debate, lula, bolsonaro, urna, turno, pesquisa, partido' },
  { emoji: '📰', label: 'Notícia', hint: 'notícia, viram isso, aconteceu, jornal, reportagem, polêmica' },
  { emoji: '🏥', label: 'Saúde', hint: 'saúde, médico, hospital, doente, gripe, remédio, exame, febre' },
  { emoji: '💘', label: 'Namoro', hint: 'namoro, crush, ficante, relacionamento, término, casal, date' },
  { emoji: '📚', label: 'Faculdade e estudo', hint: 'faculdade, prova, professor, estudo, nota, matéria, tcc' },
  { emoji: '💸', label: 'Dinheiro', hint: 'dinheiro, conta, dívida, boleto, preço, caro, salário, investimento' },
  { emoji: '🍻', label: 'Balada e rolê', hint: 'balada, bar, cerveja, sair à noite, rolê, festa, beber' },
  { emoji: '🎮', label: 'Videogame', hint: 'videogame, jogar online, ranqueada, console, valorant, lol, fifa, steam' },
  { emoji: '🎵', label: 'Show e música', hint: 'show, música, banda, festival, ingresso, cantor, playlist' },
  { emoji: '😂', label: 'Memes e zoeira', hint: 'meme, zoeira, piada, kkkkk, rindo, figurinha, me sinto atacado' },
  { emoji: '🐶', label: 'Bichos', hint: 'cachorro, gato, pet, veterinário, filhote, ração' },
  { emoji: '🏋️', label: 'Academia e esporte', hint: 'academia, treino, corrida, musculação, crossfit, dieta' },
  { emoji: '💍', label: 'Casamento', hint: 'casamento, noivado, padrinhos, madrinha, cerimônia, igreja, buffet' },
  { emoji: '👶', label: 'Bebê', hint: 'bebê, grávida, gravidez, nasceu, chá de bebê, filho' },
  { emoji: '🚗', label: 'Carro e trânsito', hint: 'carro, trânsito, uber, gasolina, oficina, acidente, multa' },
  { emoji: '🌧️', label: 'Clima', hint: 'chuva, calor, frio, tempestade, temperatura, previsão do tempo' },
  { emoji: '🏠', label: 'Casa e mudança', hint: 'casa, apartamento, mudança, aluguel, reforma, móveis' },
]

export const themePassage = (t: Theme) => `passage: conversa sobre ${t.label.toLowerCase()}: ${t.hint}`

// Calibrado com conversas de teste e um grupo real: os acertos ficaram com z perto de 3,
// e o erro (um dia de "Clima" que era outra coisa) com 2,1. Na dúvida, melhor não mostrar nada.
const MIN_Z = 2.5
const SECOND_Z = 2.8

/**
 * Decide o tema comparando com a conversa de sempre do grupo (base): temas genéricos
 * como "Comida" pontuam alto em qualquer conversa, então vale o que o trecho tem de diferente.
 * Devolve "⚽ Futebol", "🎬 Série e filme · 😂 Memes e zoeira" ou null se nada se destacar.
 */
export function pickTopic(scores: number[], base: number[], evidence?: { text: string; min: number }): string | null {
  const rel = scores.map((s, i) => s - base[i])
  const mean = rel.reduce((a, b) => a + b, 0) / rel.length
  const std = Math.sqrt(rel.reduce((a, b) => a + (b - mean) ** 2, 0) / rel.length) || 1
  const ranked = rel.map((r, i) => ({ i, z: (r - mean) / std })).sort((a, b) => b.z - a.z)
  // Além de parecido, o tema precisa aparecer no texto: o modelo às vezes acha um dia
  // "parecido com Clima" sem quase ninguém falar de chuva ou calor
  const ok = (k: number) => ranked[k].z >= (k === 0 ? MIN_Z : SECOND_Z) && (!evidence || themeHits(THEMES[ranked[k].i], evidence.text) >= evidence.min)
  if (!ok(0)) return null
  const name = (i: number) => `${THEMES[i].emoji} ${THEMES[i].label}`
  return ok(1) ? `${name(ranked[0].i)} · ${name(ranked[1].i)}` : name(ranked[0].i)
}

const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Quantas palavras do texto batem com as palavras-chave do tema (pelo começo da palavra). */
export function themeHits(theme: Theme, text: string): number {
  const stems = [...new Set([theme.label, ...theme.hint.split(',')].flatMap((h) => plain(h).match(/[a-z]{3,}/g) ?? []).map((w) => w.slice(0, 5)))]
  let hits = 0
  for (const w of plain(text).match(/[a-z0-9]{3,}/g) ?? []) if (stems.some((st) => w.startsWith(st))) hits++
  return hits
}
