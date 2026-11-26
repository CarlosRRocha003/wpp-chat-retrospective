import type { ReactNode } from 'react'
import type { FunnyCategory, PersonStats, Retro } from '../lib/stats'
import { periodKind } from '../lib/stats'
import { LAUGH_LABEL, type LaughType } from '../lib/text'
import { awardInfo, durationLabel, silenceLabel } from '../lib/awards'
import { WEEKDAYS, WEEKDAYS_SHORT, clock, dateLong, firstName, gapLabel, monthFull, num, paceLabel, plural } from '../lib/format'
import { ColumnChart, CountUp, Podium, RankBars } from './charts'
import Avatar from './Avatar'
import ChatView from './ChatView'
import AwardsGrid from './AwardsGrid'
import { AvatarStack, Who } from './People'

export interface Theme {
  bg: string
  fg: string
  dark?: boolean
  deco: [string, string]
}

const THEMES: Record<string, Theme> = {
  night: { bg: 'var(--night)', fg: 'var(--cream)', dark: true, deco: ['var(--lime)', 'var(--pink)'] },
  lime: { bg: 'var(--lime)', fg: 'var(--ink)', deco: ['var(--violet)', 'var(--sky)'] },
  violet: { bg: 'var(--violet)', fg: 'var(--cream)', dark: true, deco: ['var(--sun)', 'var(--pink)'] },
  coral: { bg: 'var(--coral)', fg: 'var(--ink)', deco: ['var(--sun)', 'var(--night)'] },
  sky: { bg: 'var(--sky)', fg: 'var(--ink)', deco: ['var(--lime)', 'var(--coral)'] },
  pink: { bg: 'var(--pink)', fg: 'var(--ink)', deco: ['var(--violet)', 'var(--sun)'] },
  sun: { bg: 'var(--sun)', fg: 'var(--ink)', deco: ['var(--coral)', 'var(--mint)'] },
  mint: { bg: 'var(--mint)', fg: 'var(--ink)', deco: ['var(--night)', 'var(--sky)'] },
  ink: { bg: 'var(--ink)', fg: 'var(--cream)', dark: true, deco: ['var(--coral)', 'var(--sky)'] },
}

export interface SlideDef {
  id: string
  theme: Theme
  content: ReactNode
}

export interface SlideHandlers {
  shared: boolean
  onPerson: (i: number) => void
  onShare: () => void
  onSaveSummary: () => void
  onCopyLink: () => void
  onNew: () => void
  onRankings: () => void
  onBack: () => void
  onNextFunny?: (category: FunnyCategory) => void
  onSaveCard?: (person: number) => void
  onBackToPeople?: () => void
}

// Foto (ou iniciais) de uma pessoa, no formato que os rankings esperam
const personRef = (r: Retro, i: number) => ({ name: r.people[i]?.name ?? '?', index: i, photo: r.people[i]?.photo })

/** As expressões que mudam conforme o período: um ano, desde o começo ou datas escolhidas. */
function periodWords(r: Retro) {
  const kind = periodKind(r)
  const label = r.period.label
  return {
    kind,
    isYear: kind === 'year',
    retro: kind === 'year' ? `Retrospectiva ${label}` : kind === 'custom' ? `Retrospectiva · ${label}` : 'Retrospectiva completa',
    within: kind === 'year' ? 'no ano' : kind === 'custom' ? 'no período' : 'nesse tempo',
    total: kind === 'year' ? `Em ${label}` : kind === 'custom' ? 'No período' : 'No total',
    whole: kind === 'year' ? 'O ano' : kind === 'custom' ? 'O período' : 'A conversa',
    ofWhole: kind === 'year' ? 'do ano' : kind === 'custom' ? 'do período' : '',
    // "do ano", "do período" ou "de todos os tempos", para títulos curtos
    ofAll: kind === 'year' ? 'do ano' : kind === 'custom' ? 'do período' : 'de todos os tempos',
    awards: kind === 'year' ? `de ${label}` : kind === 'custom' ? 'do período' : 'de sempre',
    rankings: kind === 'year' ? `de ${label}` : kind === 'custom' ? 'do período' : 'de todos os tempos',
  }
}

function argmax(values: number[]): number {
  let best = 0
  values.forEach((v, i) => {
    if (v > values[best]) best = i
  })
  return best
}

export function buildSlides(r: Retro, h: SlideHandlers): SlideDef[] {
  const name = (i: number) => r.people[i]?.name ?? '?'
  const slides: SlideDef[] = []
  const add = (id: string, theme: keyof typeof THEMES, content: ReactNode) => slides.push({ id, theme: THEMES[theme], content })
  const words = periodWords(r)
  const isYear = words.isYear
  const periodWord = words.within

  // 1. Abertura
  add(
    'intro',
    'night',
    <>
      <span className="kicker">{words.retro}</span>
      <div className="spacer" />
      <h2 style={{ fontSize: 'clamp(44px, 14vw, 72px)', color: 'var(--lime)', overflowWrap: 'anywhere' }}>{r.group}</h2>
      <AvatarStack r={r} people={r.people.slice(0, 12).map((_, i) => i)} size={46} />
      <p className="lead">
        {plural(r.people.length, 'pessoa', 'pessoas')}, {plural(r.totals.messages, 'mensagem', 'mensagens')} e muita história.
      </p>
      {h.shared && <span className="chip" style={{ alignSelf: 'flex-start' }}>compartilhada com você</span>}
      <div className="spacer" />
      <p className="muted">Toque à direita ou use as setas do teclado →</p>
    </>,
  )

  // 2. Total
  add(
    'total',
    'lime',
    <>
      <span className="kicker">{words.total}, vocês trocaram</span>
      <div className="big">
        <CountUp value={r.totals.messages} />
      </div>
      <h2>mensagens</h2>
      <p className="lead">Isso dá {paceLabel(r.totals.messages, r.totals.periodDays)}.</p>
      <div className="facts">
        <div className="fact">
          <b>{num(r.totals.words)}</b>
          <span>palavras digitadas</span>
        </div>
        <div className="fact">
          <b>
            {num(r.totals.activeDays)} de {num(r.totals.periodDays)}
          </b>
          <span>dias com alguém falando alguma coisa</span>
        </div>
      </div>
    </>,
  )

  // 3. Quem mais fala
  const talkers = r.people.map((p, i) => ({ label: p.name, value: p.messages, people: [personRef(r, i)] }))
  add(
    'ranking',
    'violet',
    <>
      <span className="kicker">Quem mais falou (em mensagens)</span>
      <h2>
        {firstName(name(0))} carregou o grupo nas costas
      </h2>
      <p className="muted">
        {Math.round((r.people[0].messages / Math.max(1, r.totals.messages)) * 100)}% de todas as mensagens {periodWord} foram de {firstName(name(0))}.
      </p>
      <RankBars items={talkers} max={8} />
    </>,
  )

  // 4. Os dias mais agitados, com pistas do porquê
  if (r.topDays.length > 0) {
    add(
      'days',
      'coral',
      <>
        <span className="kicker">Os dias mais agitados</span>
        <h2>O celular não parou</h2>
        <div className="days">
          {r.topDays.map((d, k) => (
            <div className={`day${k === 0 ? ' first' : ''}`} key={d.ts}>
              <div className="day-head">
                <span className="medal" aria-label={`${k + 1}º lugar`}>
                  {['🥇', '🥈', '🥉'][k]}
                </span>
                <div>
                  <b>{plural(d.count, 'mensagem', 'mensagens')}</b>
                  <span>
                    {dateLong(d.ts, !isYear)}, {WEEKDAYS[new Date(d.ts).getDay()]}
                  </span>
                </div>
              </div>
              {d.topic && <span className="day-topic">{d.topic}</span>}
              {d.holiday && <span className="chip day-holiday">🎉 {d.holiday}</span>}
              <span className="day-meta with-avatar">
                <Avatar name={name(d.person)} index={d.person} photo={r.people[d.person]?.photo} size={22} />
                {firstName(name(d.person))} foi quem mais falou ({num(d.personCount)}) · pico às {d.peakHour}h
                {d.photos >= 10 ? ` · ${num(d.photos)} fotos e vídeos` : ''}
              </span>
            </div>
          ))}
        </div>
      </>,
    )
  }

  // 5. Mês a mês
  if (r.months.length > 1) {
    const yearly = /^\d{4}$/.test(r.months[0].label)
    // Meses antes da primeira ou depois da última mensagem não contam como "parados"
    const first = new Date(r.period.start)
    const last = new Date(r.period.end)
    const inRange = r.months
    const peakMonth = inRange.reduce((a, b) => (b.count > a.count ? b : a), inRange[0])
    // Mês incompleto (grupo criado no meio dele, ou o mês atual) não concorre a mais parado
    const complete = inRange.filter(
      (_m, i) => words.kind === 'all' || ((i !== 0 || first.getDate() <= 5) && (i !== r.months.length - 1 || last.getDate() >= 25)),
    )
    const quietMonth = complete.length > 1 ? complete.reduce((a, b) => (b.count < a.count ? b : a), complete[0]) : peakMonth
    add(
      'months',
      'sky',
      <>
        <span className="kicker">{yearly ? 'Ano a ano' : 'Mês a mês'}</span>
        <h2>{yearly ? peakMonth.label : monthFull(peakMonth.label)} foi o auge</h2>
        <p className="lead">
          {plural(peakMonth.count, 'mensagem', 'mensagens')} {yearly ? 'nesse ano' : 'nesse mês'}.
        </p>
        <div className="spacer" />
        <ColumnChart
          height={210}
          columns={r.months.map((m) => ({ label: yearly ? m.label : monthFull(m.label), tick: yearly ? m.label.slice(2) : m.label, value: m.count }))}
        />
        {quietMonth !== peakMonth && (
          <div className="fact">
            <span className="emoji">😴</span>
            <b>{yearly ? quietMonth.label : monthFull(quietMonth.label)}</b>
            <span>
              foi {yearly ? 'o ano' : 'o mês'} mais parado, com {plural(quietMonth.count, 'mensagem', 'mensagens')}
            </span>
          </div>
        )}
      </>,
    )
  }

  // 6. Horários
  const hours = Array.from({ length: 24 }, (_, hr) => r.heat.reduce((a, v, i) => (i % 24 === hr ? a + v : a), 0))
  const week = Array.from({ length: 7 }, (_, d) => r.heat.slice(d * 24, d * 24 + 24).reduce((a, b) => a + b, 0))
  // Médias: por hora, divide pelos dias do período; por dia da semana, por quantas vezes ele aconteceu
  const firstDay = new Date(r.period.start)
  const spanDays = Math.max(1, r.totals.periodDays)
  const weekdayCount = new Array(7).fill(0)
  for (let k = 0; k < spanDays; k++) weekdayCount[(firstDay.getDay() + k) % 7]++
  const hourAvg = hours.map((v) => v / spanDays)
  const weekAvg = week.map((v, d) => v / Math.max(1, weekdayCount[d]))
  const avgLabel = (v: number) => (v < 10 ? v.toFixed(1).replace('.', ',') : num(v))
  const peakHour = argmax(hourAvg)
  const peakDay = argmax(weekAvg)
  const owl = argmax(r.people.map((p) => p.night))
  const opener = argmax(r.people.map((p) => p.dayOpeners))
  add(
    'hours',
    'night',
    <>
      <span className="kicker">Quando o grupo acorda</span>
      <h2>O horário mais animado é {peakHour}h</h2>
      <p className="muted">Média de mensagens por dia em cada horário.</p>
      <ColumnChart
        height={100}
        columns={hourAvg.map((v, hr) => ({
          label: `${hr}h`,
          tick: hr % 6 === 0 ? `${hr}h` : '',
          value: v,
          caption: `Às ${hr}h: em média ${avgLabel(v)} ${v >= 0.95 && v < 1.05 ? 'mensagem' : 'mensagens'} por dia`,
        }))}
      />
      <p className="lead">
        E o dia mais animado é {peakDay === 0 || peakDay === 6 ? 'o' : 'a'} {WEEKDAYS[peakDay]}.
      </p>
      <ColumnChart
        height={60}
        columns={[1, 2, 3, 4, 5, 6, 0].map((d) => ({
          label: WEEKDAYS[d],
          tick: WEEKDAYS_SHORT[d],
          value: weekAvg[d],
          caption: `${WEEKDAYS[d][0].toUpperCase() + WEEKDAYS[d].slice(1)}: em média ${avgLabel(weekAvg[d])} mensagens`,
        }))}
      />
      <div className="facts two">
        {r.people[owl].night > 0 && (
          <div className="fact">
            <span className="emoji">🦉</span>
            <Who r={r} i={owl} />
            <span>{plural(r.people[owl].night, 'mensagem', 'mensagens')} de madrugada</span>
          </div>
        )}
        <div className="fact">
          <span className="emoji">⏰</span>
          <Who r={r} i={opener} />
          <span>abriu o dia {plural(r.people[opener].dayOpeners, 'vez', 'vezes')}</span>
        </div>
      </div>
    </>,
  )

  // 7. Sequência e silêncio
  if (r.streak) {
    add(
      'streak',
      'sun',
      <>
        <span className="kicker">Maior sequência</span>
        <div className="big">
          <CountUp value={r.streak.days} />
        </div>
        <h2>dias seguidos de conversa</h2>
        <p className="lead">
          De {dateLong(r.streak.start)} a {dateLong(r.streak.end, !isYear)}, ninguém deixou o grupo dormir.
        </p>
        <div className="spacer" />
        {r.silence && (
          <div className="fact">
            <span className="emoji">🤫</span>
            <b>{gapLabel(r.silence.ms)} de silêncio</b>
            <span>
              Foi o maior vácuo coletivo, de {dateLong(r.silence.start)} até {dateLong(r.silence.end)}.
            </span>
          </div>
        )}
      </>,
    )
  }

  // 8. Mídia: só os totais; quem mandou mais fica nos rankings
  const m = r.totals.media
  const totalMedia = Object.values(m).reduce((a, b) => a + b, 0)
  if (totalMedia > 0) {
    const perDay = (n: number) => {
      const v = n / Math.max(1, r.totals.activeDays)
      return v >= 1 ? `${v.toFixed(1).replace('.', ',')} por dia` : `uma a cada ${Math.round(1 / v)} dias`
    }
    const items: Array<[string, string, number]> = [
      ['🃏', 'figurinhas', m.sticker],
      ['🎙️', 'áudios', m.audio],
      ['📸', 'fotos e vídeos', m.image + m.video],
      ['🎞️', 'gifs', m.gif],
      ['📄', 'documentos', m.document],
    ]
    add(
      'media',
      'pink',
      <>
        <span className="kicker">Fotos, figurinhas e áudios</span>
        <div className="big">
          <CountUp value={totalMedia} />
        </div>
        <h2>arquivos mandados</h2>
        {r.mediaTyped ? (
          <div className="facts">
            {items
              .filter(([, , n]) => n > 0)
              .slice(0, 4)
              .map(([emoji, label, n]) => (
                <div className="fact" key={label}>
                  <span className="emoji">{emoji}</span>
                  <b>
                    {num(n)} {label}
                  </b>
                  <span>{perDay(n)}</span>
                </div>
              ))}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>
            Dica: exportando a conversa com mídia dá pra separar figurinha, áudio e foto.
          </p>
        )}
      </>,
    )
  }

  // 9. Risadas
  if (r.totals.laughs > 0) {
    const types = (Object.entries(r.laughTypes) as [LaughType, number][]).sort((a, b) => b[1] - a[1])
    add(
      'laughs',
      'lime',
      <>
        <span className="kicker">Risadas</span>
        <div className="big">
          <CountUp value={r.totals.laughs} />
        </div>
        <h2>vezes que alguém riu por escrito</h2>
        <RankBars items={types.map(([t, v]) => ({ label: LAUGH_LABEL[t], value: v }))} max={4} />
        <div className="facts">
          {r.longestLaugh && r.longestLaugh.text.length >= 8 && (
            <div className="fact">
              <b style={{ overflowWrap: 'anywhere' }}>
                {r.longestLaugh.text.length > 28 ? r.longestLaugh.text.slice(0, 28) + '…' : r.longestLaugh.text}
              </b>
              <span>
                O maior kkk {words.ofAll}, com {r.longestLaugh.text.length} letras, foi de {firstName(name(r.longestLaugh.person))}.
              </span>
            </div>
          )}
        </div>
      </>,
    )
  }

  // 9b. Os momentos mais engraçados, numa tela de conversa: o geral e um por tipo
  const FUNNY_TITLES: Record<FunnyCategory, { kicker: string; title: (who: string) => string; theme: keyof typeof THEMES }> = {
    geral: { kicker: 'O momento mais engraçado', title: (who) => `${who} fez o grupo rir`, theme: 'violet' },
    audio: { kicker: 'O áudio mais engraçado', title: (who) => `Aperta o play no áudio de ${who}`, theme: 'sun' },
    sticker: { kicker: 'A figurinha mais engraçada', title: (who) => `A figurinha de ${who}`, theme: 'sky' },
  }
  for (const { category, moment, options, choice } of r.funnies) {
    if (!moment.bubbles.some((b) => b.text || b.media || b.audio)) continue
    const trigger = moment.bubbles[moment.trigger]
    const info = FUNNY_TITLES[category]
    add(
      `funny-${category}`,
      info.theme,
      <>
        <span className="kicker">{info.kicker}</span>
        <h2>{info.title(firstName(name(trigger.person)))}</h2>
        <p className="lead">
          {dateLong(trigger.ts, !isYear)}, às {clock(trigger.ts)}
        </p>
        <ChatView moment={moment} people={r.people} group={r.group} />
        {!h.shared && h.onNextFunny && options && options.length > 1 && (
          <button
            className="btn small ghost funny-next"
            onClick={(e) => {
              e.stopPropagation()
              h.onNextFunny!(category)
            }}
          >
            🔀 Outra opção ({(choice ?? 0) + 1} de {options.length})
          </button>
        )}
        {trigger.kind === 'audio' && !trigger.audio && (
          <p className="muted" style={{ fontSize: 13 }}>
            O áudio só toca para quem abriu o export com mídia.
          </p>
        )}
      </>,
    )
  }

  // 10. Emojis
  if (r.topEmojis.length >= 3) {
    add(
      'emojis',
      'ink',
      <>
        <span className="kicker">Os emojis do grupo</span>
        <h2>{num(r.totals.emojis)} emojis</h2>
        <div className="emoji-grid">
          {r.topEmojis.slice(0, 10).map(([e, c]) => (
            <div key={e}>
              <span>{e}</span>
              {num(c)}
            </div>
          ))}
        </div>
      </>,
    )
  }

  // 11. Duplas
  const fastest = r.people
    .map((p, i) => ({ i, s: p.replyMedianSec }))
    .filter((x) => x.s !== null)
    .sort((a, b) => a.s! - b.s!)[0]
  const pair = r.pairs[0]
  if (pair) {
    add(
      'dynamics',
      'mint',
      <>
        <span className="kicker">As duplas {words.ofAll}</span>
        <AvatarStack r={r} people={[pair[0], pair[1]]} size={78} />
        <h2>
          {firstName(name(pair[0]))} & {firstName(name(pair[1]))}
        </h2>
        <p className="lead">{num(pair[2])} respostas trocadas em menos de 5 minutos.</p>
        <RankBars
          items={r.pairs.slice(0, 3).map(([a, b, n]) => ({ label: `${firstName(name(a))} & ${firstName(name(b))}`, value: n, people: [personRef(r, a), personRef(r, b)] }))}
        />
        <div className="spacer" />
        {fastest && (
          <div className="fact">
            <span className="emoji">🏎️</span>
            <Who r={r} i={fastest.i} full />
            <span>responde mais rápido: {durationLabel(fastest.s! * 1000)}, na mediana</span>
          </div>
        )}
      </>,
    )
  }

  // 12. Bordões
  const withCatch = r.people.map((p, i) => ({ i, c: p.catchphrases ?? [] })).filter((x) => x.c.length > 0)
  if (withCatch.length > 0) {
    add(
      'catchphrases',
      'violet',
      <>
        <span className="kicker">Bordões</span>
        <h2>Cada um com seu dialeto</h2>
        <p className="muted">As palavras que cada pessoa usa bem mais que o resto do grupo.</p>
        <div className="catch">
          {withCatch.slice(0, 9).map(({ i, c }) => (
            <div className="catch-row" key={i}>
              <Who r={r} i={i} full />
              <div>
                {c.map((w) => (
                  <span className="chip" key={w}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </>,
    )
  }

  // 13. Maiores textões e monólogo
  if (r.longTexts.length > 0) {
    add(
      'textao',
      'coral',
      <>
        <span className="kicker">Os maiores textões</span>
        <h2>{plural(r.longTexts[0].words, 'palavra', 'palavras')} numa mensagem só</h2>
        <p className="lead">
          O recorde é de {name(r.longTexts[0].person)}.
        </p>
        <div className="texts">
          {r.longTexts.map((t) => (
            <div className="text-row" key={t.ts}>
              <span className="pos">{r.longTexts.findIndex((x) => x.words === t.words) + 1}º</span>
              <Avatar name={name(t.person)} index={t.person} photo={r.people[t.person]?.photo} size={36} />
              <div>
                <b>{name(t.person)}</b>
                <span>
                  {dateLong(t.ts, !isYear)}
                  {t.topic ? ` · ${t.topic}` : ''}
                </span>
              </div>
              <strong>{num(t.words)}</strong>
            </div>
          ))}
        </div>
        <div className="spacer" />
        {r.monologue && r.monologue.len >= 8 && (
          <div className="fact">
            <span className="emoji">🎭</span>
            <b>{plural(r.monologue.len, 'mensagem seguida', 'mensagens seguidas')}</b>
            <span>
              O maior monólogo foi de {firstName(name(r.monologue.person))}, sem ninguém interromper.
            </span>
          </div>
        )}
      </>,
    )
  }

  // 14. Primeira e última
  if (r.first?.text && r.last?.text) {
    add(
      'firstlast',
      'sky',
      <>
        <span className="kicker">Do começo ao fim</span>
        <h2>{words.whole} em duas mensagens</h2>
        <span className="kicker">Primeira mensagem {words.ofWhole}</span>
        <div className="quote">“{r.first.text}”</div>
        <p className="muted">
          {name(r.first.person)}, {dateLong(r.first.ts, !isYear)}
        </p>
        <div className="spacer" />
        <span className="kicker">E a última, até agora</span>
        <div className="quote">“{r.last.text}”</div>
        <p className="muted">
          {name(r.last.person)}, {dateLong(r.last.ts, !isYear)}
        </p>
      </>,
    )
  }

  // 15. Prêmios
  add(
    'awards',
    'night',
    <>
      <span className="kicker">Os prêmios {words.awards}</span>
      <h2>Cada um com seu troféu</h2>
      <p className="muted">Toque num cartão para ver o porquê.</p>
      <AwardsGrid retro={r} />
    </>,
  )

  // 16. Final
  add(
    'end',
    'pink',
    <>
      <span className="kicker">E você?</span>
      <h2>A retrospectiva de cada um</h2>
      <p className="muted">Toque em alguém para ver os números da pessoa.</p>
      <div className="people-grid" onClick={(e) => e.stopPropagation()}>
        {r.people.slice(0, 30).map((p, i) => (
          <button key={i} className="person-tile" onClick={() => h.onPerson(i)}>
            <Avatar name={p.name} index={i} photo={p.photo} size={56} />
            <span>{firstName(p.name)}</span>
          </button>
        ))}
      </div>
      <div className="spacer" />
      <div className="slide-actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn" onClick={h.onRankings}>
          Ver os rankings →
        </button>
        <button className="btn dark" onClick={h.onSaveSummary}>
          Salvar resumo como imagem
        </button>
        {h.shared ? (
          <>
            <button className="btn ghost" onClick={h.onCopyLink}>
              Copiar este link
            </button>
            <button className="btn ghost" onClick={h.onNew}>
              Fazer a do meu grupo
            </button>
          </>
        ) : (
          <button className="btn ghost" onClick={h.onShare}>
            Gerar link para o grupo
          </button>
        )}
      </div>
    </>,
  )

  return slides
}

interface RankingDef {
  id: string
  title: string
  sub: string
  value: (p: PersonStats) => number
  /** Texto extra ao lado do nome, como o emoji favorito */
  tag?: (p: PersonStats) => string
  min: number
  show?: boolean
  extra?: ReactNode
}

const RANKING_THEMES: Array<keyof typeof THEMES> = ['lime', 'coral', 'sky', 'pink', 'sun', 'mint']

/** A segunda parte: um top por slide. */
export function buildRankingSlides(r: Retro, h: SlideHandlers): SlideDef[] {
  const words = periodWords(r)
  const typed = r.mediaTyped
  const topLaugh = (p: PersonStats) => {
    const best = (Object.entries(p.laughTypes) as [LaughType, number][]).sort((a, b) => b[1] - a[1])[0]
    return best ? LAUGH_LABEL[best[0]] : ''
  }
  const defs: RankingDef[] = [
    { id: 'words', title: 'Quem mais escreveu', sub: 'em palavras digitadas', value: (p) => p.words, min: 1 },
    { id: 'audio', title: 'Quem mais mandou áudio', sub: 'áudios no total', value: (p) => p.media.audio, min: 5, show: typed },
    { id: 'sticker', title: 'Quem mais mandou figurinha', sub: 'figurinhas no total', value: (p) => p.media.sticker, min: 5, show: typed },
    { id: 'photo', title: 'Quem mais mandou foto e vídeo', sub: 'fotos, vídeos e gifs', value: (p) => p.media.image + p.media.video + p.media.gif, min: 5, show: typed },
    {
      id: 'media',
      title: 'Quem mais mandou mídia',
      sub: 'fotos, figurinhas, áudios e afins',
      value: (p) => Object.values(p.media).reduce((a, b) => a + b, 0),
      min: 5,
      show: !typed,
    },
    { id: 'laughs', title: 'Quem mais riu', sub: 'risadas por escrito, com o jeito de rir de cada um', value: (p) => p.laughs, tag: topLaugh, min: 10 },
    { id: 'emojis', title: 'Quem mais usou emoji', sub: 'emojis, com o favorito de cada um', value: (p) => p.emojiCount, tag: (p) => p.topEmojis[0]?.[0] ?? '', min: 10 },
    { id: 'questions', title: 'Quem mais perguntou', sub: 'mensagens terminando em ?', value: (p) => p.questions, min: 10 },
    { id: 'night', title: 'Quem mais falou de madrugada', sub: 'mensagens entre meia-noite e 5h', value: (p) => p.night, min: 10 },
    {
      id: 'revives',
      title: 'Quem mais ressuscitou o grupo',
      sub: `primeira mensagem depois de ${silenceLabel(r.reviveThresholdH)} de silêncio`,
      value: (p) => p.revives,
      min: 3,
    },
    {
      id: 'links',
      title: 'Quem mais mandou link',
      sub: 'links compartilhados',
      value: (p) => p.links,
      min: 5,
      extra:
        r.domains.length > 0 ? (
          <div className="catch-row">
            <b>De onde vieram</b>
            <div>
              {r.domains.map(([d, n]) => (
                <span className="chip" key={d}>
                  {d} · {num(n)}
                </span>
              ))}
            </div>
          </div>
        ) : null,
    },
  ]

  const active = defs.filter((d) => {
    if (d.show === false) return false
    const values = r.people.map(d.value)
    return values.reduce((a, b) => a + b, 0) >= d.min && values.filter((v) => v > 0).length >= 2
  })

  const slides: SlideDef[] = [
    {
      id: 'r-intro',
      theme: THEMES.violet,
      content: (
        <>
          <span className="kicker">Parte 2</span>
          <div className="spacer" />
          <h2 style={{ fontSize: 'clamp(44px, 14vw, 72px)' }}>Os rankings</h2>
          <p className="lead">
            {active.length} disputas {words.rankings}. Quem ficou em primeiro em cada uma?
          </p>
          <div className="spacer" />
          <p className="muted">Toque à direita para avançar →</p>
        </>
      ),
    },
  ]

  active.forEach((d, k) => {
    const items = r.people
      .map((p, index) => ({ name: p.name, index, photo: p.photo, value: d.value(p), tag: d.tag?.(p) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
    const total = r.people.reduce((a, p) => a + d.value(p), 0)
    slides.push({
      id: `r-${d.id}`,
      theme: THEMES[RANKING_THEMES[k % RANKING_THEMES.length]],
      content: (
        <>
          <span className="kicker">
            Ranking {k + 1} de {active.length}
          </span>
          <h2>{d.title}</h2>
          <p className="muted">
            {num(total)} {d.sub}
          </p>
          <div className="spacer" />
          <Podium items={items} />
          <div className="spacer" />
          {d.extra}
        </>
      ),
    })
  })

  slides.push({
    id: 'r-end',
    theme: THEMES.night,
    content: (
      <>
        <span className="kicker">Fim dos rankings</span>
        <h2>E o troféu de cada um?</h2>
        <p className="lead">Volte à retrospectiva para ver os prêmios e o cartão de cada pessoa.</p>
        <div className="spacer" />
        <div className="slide-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn" onClick={h.onBack}>
            ← Voltar à retrospectiva
          </button>
          {h.shared ? (
            <button className="btn ghost" onClick={h.onCopyLink}>
              Copiar este link
            </button>
          ) : (
            <button className="btn ghost" onClick={h.onShare}>
              Gerar link para o grupo
            </button>
          )}
        </div>
      </>
    ),
  })
  return slides
}

/** Posição da pessoa num ranking (empate divide a posição). */
function rankOf(values: number[], i: number): number {
  return values.filter((v) => v > values[i]).length + 1
}

const avgText = (v: number) => (v < 10 ? v.toFixed(1).replace('.', ',') : num(v))

/** A retrospectiva de uma pessoa só. */
export function buildPersonSlides(r: Retro, i: number, h: SlideHandlers): SlideDef[] {
  const p = r.people[i]
  if (!p) return []
  const who = firstName(p.name)
  const name = (k: number) => r.people[k]?.name ?? '?'
  const words = periodWords(r)
  const isYear = words.isYear
  const n = r.people.length
  const slides: SlideDef[] = []
  const add = (id: string, theme: keyof typeof THEMES, content: ReactNode) => slides.push({ id: `p${i}-${id}`, theme: THEMES[theme], content })
  const award = r.awards.find((a) => a.person === i)
  const info = award ? awardInfo(award, r) : null
  const groupAvg = r.totals.messages / Math.max(1, n)

  // 1. Abertura
  add(
    'intro',
    'night',
    <>
      <span className="kicker">
        {words.retro} · {r.group}
      </span>
      <div className="spacer" />
      <Avatar name={p.name} index={i} photo={p.photo} size={120} />
      <h2 style={{ fontSize: 'clamp(44px, 14vw, 72px)', color: 'var(--lime)', overflowWrap: 'anywhere' }}>{p.name}</h2>
      {info && (
        <p className="lead">
          {info.emoji} {info.title}: {info.description}
        </p>
      )}
      <div className="spacer" />
      <p className="muted">Toque à direita ou use as setas do teclado →</p>
    </>,
  )

  // 2. Mensagens
  const wordsAvg = p.textMessages ? p.words / p.textMessages : 0
  const groupWordsAvg = r.totals.words / Math.max(1, r.people.reduce((s, x) => s + x.textMessages, 0))
  const vsAvg = Math.round((p.messages / groupAvg - 1) * 100)
  add(
    'msgs',
    'lime',
    <>
      <span className="kicker">{who} mandou</span>
      <div className="big">
        <CountUp value={p.messages} />
      </div>
      <h2>mensagens</h2>
      <p className="lead">
        {rankOf(
          r.people.map((x) => x.messages),
          i,
        )}
        º lugar no grupo, {Math.round((p.messages / Math.max(1, r.totals.messages)) * 100)}% de tudo que foi dito.
      </p>
      <div className="facts">
        <div className="fact">
          <b>{vsAvg >= 0 ? `${vsAvg}% acima` : `${-vsAvg}% abaixo`} da média</b>
          <span>a média do grupo foi {num(groupAvg)} mensagens por pessoa</span>
        </div>
        <div className="fact">
          <b>{avgText(wordsAvg)} palavras por mensagem</b>
          <span>o grupo escreve {avgText(groupWordsAvg)} em média</span>
        </div>
        <div className="fact">
          <b>
            {num(p.activeDays)} de {num(r.totals.periodDays)} dias
          </b>
          <span>com pelo menos uma mensagem de {who}</span>
        </div>
      </div>
    </>,
  )

  // 3. Horários
  const span = Math.max(1, r.totals.periodDays)
  const firstDay = new Date(r.period.start)
  const weekdayCount = new Array(7).fill(0)
  for (let k = 0; k < span; k++) weekdayCount[(firstDay.getDay() + k) % 7]++
  const hourAvg = p.hours.map((v) => v / span)
  const weekAvg = p.week.map((v, d) => v / Math.max(1, weekdayCount[d]))
  const peakHour = argmax(hourAvg)
  const peakDay = argmax(weekAvg)
  add(
    'hours',
    'violet',
    <>
      <span className="kicker">Quando {who} fala</span>
      <h2>O horário favorito é {peakHour}h</h2>
      <p className="muted">Média de mensagens por dia em cada horário.</p>
      <ColumnChart
        height={100}
        columns={hourAvg.map((v, hr) => ({
          label: `${hr}h`,
          tick: hr % 6 === 0 ? `${hr}h` : '',
          value: v,
          caption: `Às ${hr}h: em média ${avgText(v)} mensagens por dia`,
        }))}
      />
      <p className="lead">
        E o dia da semana em que mais fala é {peakDay === 0 || peakDay === 6 ? 'o' : 'a'} {WEEKDAYS[peakDay]}.
      </p>
      <ColumnChart
        height={60}
        columns={[1, 2, 3, 4, 5, 6, 0].map((d) => ({
          label: WEEKDAYS[d],
          tick: WEEKDAYS_SHORT[d],
          value: weekAvg[d],
          caption: `${WEEKDAYS[d][0].toUpperCase() + WEEKDAYS[d].slice(1)}: em média ${avgText(weekAvg[d])} mensagens`,
        }))}
      />
      {p.night > 0 && (
        <div className="fact">
          <span className="emoji">🦉</span>
          <b>{plural(p.night, 'mensagem', 'mensagens')} de madrugada</b>
          <span>
            {rankOf(
              r.people.map((x) => x.night),
              i,
            )}
            º lugar entre as corujas do grupo
          </span>
        </div>
      )}
    </>,
  )

  // 4. Mês a mês e o dia em que mais falou
  if (r.months.length > 1) {
    const yearly = /^\d{4}$/.test(r.months[0].label)
    const peak = argmax(p.months)
    add(
      'months',
      'sky',
      <>
        <span className="kicker">{yearly ? 'Ano a ano' : 'Mês a mês'}</span>
        <h2>
          {yearly ? r.months[peak].label : monthFull(r.months[peak].label)} foi o auge de {who}
        </h2>
        <div className="spacer" />
        <ColumnChart
          height={190}
          columns={r.months.map((m, k) => ({ label: yearly ? m.label : monthFull(m.label), tick: yearly ? m.label.slice(2) : m.label, value: p.months[k] }))}
        />
        {p.busiestDay && (
          <div className="fact">
            <span className="emoji">📅</span>
            <b>{dateLong(p.busiestDay.ts, !isYear)}</b>
            <span>
              o dia em que {who} mais falou: {plural(p.busiestDay.count, 'mensagem', 'mensagens')}
            </span>
          </div>
        )}
      </>,
    )
  }

  // 5. O jeito de escrever
  const laugh = (Object.entries(p.laughTypes) as [LaughType, number][]).sort((a, b) => b[1] - a[1])[0]
  add(
    'style',
    'sun',
    <>
      <span className="kicker">O jeito de {who}</span>
      <h2>{laugh ? `Ri de ${LAUGH_LABEL[laugh[0]]}` : 'Quase não ri por escrito'}</h2>
      <div className="facts">
        {p.laughs > 0 && (
          <div className="fact">
            <span className="emoji">🤣</span>
            <b>{plural(p.laughs, 'risada', 'risadas')}</b>
            <span>
              {rankOf(
                r.people.map((x) => x.laughs),
                i,
              )}
              º do grupo que mais ri
            </span>
          </div>
        )}
        {p.topEmojis.length > 0 && (
          <div className="fact">
            <b style={{ fontSize: 30 }}>{p.topEmojis.map(([e]) => e).join(' ')}</b>
            <span>
              os emojis favoritos, {plural(p.emojiCount, 'emoji', 'emojis')} no total
            </span>
          </div>
        )}
        {p.catchphrases && p.catchphrases.length > 0 && (
          <div className="fact">
            <b>“{p.catchphrases.join('”, “')}”</b>
            <span>as palavras que {who} usa bem mais que o resto do grupo</span>
          </div>
        )}
        <div className="fact">
          <b>{plural(p.questions, 'pergunta', 'perguntas')}</b>
          <span>
            e {plural(p.caps, 'mensagem', 'mensagens')} EM CAIXA ALTA
          </span>
        </div>
      </div>
    </>,
  )

  // 6. Mídia
  const mediaItems: Array<[string, string, (x: PersonStats) => number]> = r.mediaTyped
    ? [
        ['🃏', 'figurinhas', (x) => x.media.sticker],
        ['🎙️', 'áudios', (x) => x.media.audio],
        ['📸', 'fotos e vídeos', (x) => x.media.image + x.media.video + x.media.gif],
      ]
    : [['📎', 'arquivos', (x) => Object.values(x.media).reduce((a, b) => a + b, 0)]]
  const mediaTotal = mediaItems.reduce((s, [, , f]) => s + f(p), 0)
  if (mediaTotal > 0) {
    add(
      'media',
      'pink',
      <>
        <span className="kicker">Fotos, figurinhas e áudios</span>
        <div className="big">
          <CountUp value={mediaTotal} />
        </div>
        <h2>arquivos de {who}</h2>
        <div className="facts">
          {mediaItems
            .filter(([, , f]) => f(p) > 0)
            .map(([emoji, label, f]) => (
              <div className="fact" key={label}>
                <span className="emoji">{emoji}</span>
                <b>
                  {num(f(p))} {label}
                </b>
                <span>{rankOf(r.people.map(f), i)}º do grupo</span>
              </div>
            ))}
        </div>
      </>,
    )
  }

  // 7. Conexões
  if (p.partner >= 0 || p.laughedBy.length > 0 || p.laughedAt.length > 0) {
    add(
      'people',
      'mint',
      <>
        <span className="kicker">Com quem {who} se conecta</span>
        {p.partner >= 0 && <AvatarStack r={r} people={[i, p.partner]} size={64} />}
        {p.partner >= 0 && (
          <h2>
            {who} & {firstName(name(p.partner))}
          </h2>
        )}
        {p.partner >= 0 && <p className="lead">{num(p.partnerCount)} respostas trocadas em menos de 5 minutos.</p>}
        {p.laughedBy.length > 0 && (
          <div className="conn">
            <b>Quem mais riu das mensagens de {who}</b>
            <RankBars items={p.laughedBy.map(([k, c]) => ({ label: name(k), value: c, people: [personRef(r, k)] }))} max={3} />
          </div>
        )}
        {p.laughedAt.length > 0 && (
          <div className="conn">
            <b>De quem {who} mais riu</b>
            <RankBars items={p.laughedAt.map(([k, c]) => ({ label: name(k), value: c, people: [personRef(r, k)] }))} max={3} />
          </div>
        )}
      </>,
    )
  }

  // 8. O momento engraçado provocado pela pessoa
  if (p.funny && p.funny.bubbles.some((b) => b.text || b.media || b.audio)) {
    const t = p.funny.bubbles[p.funny.trigger]
    add(
      'funny',
      'coral',
      <>
        <span className="kicker">Quando {who} fez o grupo rir</span>
        <h2>O momento de {who}</h2>
        <p className="lead">
          {dateLong(t.ts, !isYear)}, às {clock(t.ts)}
        </p>
        <ChatView moment={p.funny} people={r.people} group={r.group} />
      </>,
    )
  }

  // 9. Fim: prêmio e cartão
  add(
    'end',
    'night',
    <>
      <span className="kicker">O troféu de {who}</span>
      {info && <span style={{ fontSize: 64, lineHeight: 1 }}>{info.emoji}</span>}
      <h2>{info?.title ?? 'Presença garantida'}</h2>
      {info && <p className="lead">{info.description}</p>}
      <div className="spacer" />
      <div className="slide-actions" onClick={(e) => e.stopPropagation()}>
        {h.onSaveCard && (
          <button className="btn" onClick={() => h.onSaveCard!(i)}>
            Salvar o cartão de {who}
          </button>
        )}
        {h.onBackToPeople && (
          <button className="btn ghost" onClick={h.onBackToPeople}>
            Ver outra pessoa
          </button>
        )}
      </div>
    </>,
  )
  return slides
}
