import { useEffect, useState, type MouseEvent } from 'react'
import { num } from '../lib/format'
import Avatar from './Avatar'

const stop = (e: MouseEvent) => e.stopPropagation()

function useCountUp(target: number, duration = 1100): number {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const [value, setValue] = useState(reduced ? target : 0)
  useEffect(() => {
    if (reduced) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, reduced])
  return reduced ? target : value
}

export function CountUp({ value }: { value: number }) {
  return <>{num(useCountUp(value))}</>
}

export interface RankItem {
  label: string
  value: number
  display?: string
  /** Pessoas da linha (uma, ou duas numa dupla), para mostrar a foto ao lado do nome */
  people?: { name: string; index: number; photo?: string }[]
}

export function RankBars({ items, max = 8 }: { items: RankItem[]; max?: number }) {
  const shown = items.slice(0, max)
  const top = Math.max(...shown.map((i) => i.value), 1)
  const rest = items.length - shown.length
  return (
    <div className="rank">
      {shown.map((item, i) => (
        <div key={item.label} className={`rank-row${i === 0 ? ' top' : ''}`}>
          <span className="pos">{i + 1}</span>
          <div className="who">
            <span className="who-name">
              {item.people && (
                <span className="avatars">
                  {item.people.map((p) => (
                    <Avatar key={p.index} name={p.name} index={p.index} photo={p.photo} size={i === 0 ? 30 : 24} />
                  ))}
                </span>
              )}
              <span className="who-label">{item.label}</span>
            </span>
            <div className="bar" style={{ width: `${Math.max(2, (item.value / top) * 100)}%`, animationDelay: `${0.1 + i * 0.06}s` }} />
          </div>
          <span className="val">{item.display ?? num(item.value)}</span>
        </div>
      ))}
      {rest > 0 && <p className="muted">e mais {rest} {rest === 1 ? 'pessoa' : 'pessoas'}</p>}
    </div>
  )
}

export interface Column {
  label: string // texto completo, usado no detalhe
  tick: string // rótulo curto embaixo da coluna ('' para esconder)
  value: number
  caption?: string // detalhe mostrado ao tocar; o padrão é "rótulo: valor"
}

/** Colunas de uma série só; toque ou passe o mouse para ver o valor. */
export function ColumnChart({ columns, unit = 'mensagens', height = 150 }: { columns: Column[]; unit?: string; height?: number }) {
  const max = Math.max(...columns.map((c) => c.value), 1)
  const peak = columns.findIndex((c) => c.value === max)
  const [sel, setSel] = useState<number | null>(null)
  const shown = sel ?? peak
  return (
    <div onClick={stop}>
      <div className="months" style={{ ['--n' as string]: columns.length, height }} role="img" aria-label={columns.map((c) => `${c.label}: ${c.value}`).join(', ')}>
        {columns.map((c, i) => (
          <button
            key={c.label}
            className={i === sel ? 'sel' : ''}
            onMouseEnter={() => setSel(i)}
            onMouseLeave={() => setSel(null)}
            onClick={() => setSel(i === sel ? null : i)}
            aria-label={`${c.label}: ${num(c.value)} ${unit}`}
          >
            <div className={`col${i === peak ? ' peak' : ''}`} style={{ height: `${(c.value / max) * 100}%`, animationDelay: `${i * 0.02}s` }} />
            <small>{c.tick}</small>
          </button>
        ))}
      </div>
      <div className="caption">
        {columns[shown] ? (columns[shown].caption ?? `${columns[shown].label}: ${num(columns[shown].value)} ${unit}`) + (shown === peak ? ' (o pico)' : '') : ''}
      </div>
    </div>
  )
}

export interface PodiumItem {
  name: string
  index: number // posição da pessoa no grupo, para a cor do avatar
  photo?: string
  value: number
  tag?: string
}

/** Os três primeiros num pódio e o resto numa lista simples. */
export function Podium({ items, rest = 5 }: { items: PodiumItem[]; rest?: number }) {
  // Empate divide a posição (1º, 2º, 3º, 3º, 5º...)
  const ranks = items.map((it) => items.findIndex((x) => x.value === it.value) + 1)
  const top = items.slice(0, 3)
  // Ordem visual: 2º, 1º, 3º
  const order = [1, 0, 2].filter((i) => i < top.length)
  const others = items.slice(3, 3 + rest)
  const hidden = items.length - 3 - others.length
  return (
    <div className="podium-wrap">
      <div className="podium">
        {order.map((pos) => {
          const it = top[pos]
          return (
            <div className={`step p${pos + 1}`} key={it.name}>
              <Avatar name={it.name} index={it.index} photo={it.photo} size={pos === 0 ? 76 : 58} />
              <b>{it.name}</b>
              <span className="val">
                {num(it.value)}
                {it.tag ? ` ${it.tag}` : ''}
              </span>
              <div className="block">{ranks[pos]}º</div>
            </div>
          )
        })}
      </div>
      {others.length > 0 && (
        <ol className="rest" start={4}>
          {others.map((it, k) => (
            <li key={it.name}>
              <span className="pos">{ranks[3 + k]}º</span>
              <Avatar name={it.name} index={it.index} photo={it.photo} size={28} />
              <span className="who">{it.name}</span>
              <span className="val">
                {num(it.value)}
                {it.tag ? ` ${it.tag}` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
      {hidden > 0 && <p className="muted" style={{ fontSize: 13 }}>e mais {hidden} {hidden === 1 ? 'pessoa' : 'pessoas'}</p>}
    </div>
  )
}
