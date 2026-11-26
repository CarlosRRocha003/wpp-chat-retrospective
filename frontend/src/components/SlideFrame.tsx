import { Children, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import type { SlideDef } from './slides'

const LAYOUTS: Array<(a: string, b: string) => ReactNode> = [
  (a, b) => (
    <>
      <div className="deco circle" style={{ background: a, width: 260, height: 260, right: -90, bottom: -70 }} />
      <div className="deco square" style={{ background: b, width: 70, height: 70, left: 24, bottom: -20, transform: 'rotate(18deg)' }} />
    </>
  ),
  (a, b) => (
    <>
      <div className="deco ring" style={{ color: a, width: 300, height: 300, left: -130, bottom: -120 }} />
      <div className="deco circle" style={{ background: b, width: 70, height: 70, right: -20, bottom: -20 }} />
    </>
  ),
  (a, b) => (
    <>
      <div className="deco square" style={{ background: a, width: 200, height: 200, right: -100, bottom: -60, transform: 'rotate(-14deg)' }} />
      <div className="deco circle" style={{ background: b, width: 120, height: 120, left: -50, bottom: -40 }} />
    </>
  ),
]

/** Título, número grande e frases curtas ficam à esquerda no modo TV; o resto vai para a direita. */
function isHeadline(node: ReactNode): boolean {
  if (!isValidElement(node) || typeof node.type !== 'string') return false
  const className = String((node.props as { className?: string }).className ?? '')
  return ['h2', 'p', 'span'].includes(node.type) || /\b(kicker|big|lead|chip|spacer)\b/.test(className)
}

/** No modo TV, separa o conteúdo do slide em duas colunas, cada uma centralizada na vertical. */
function splitForTv(content: ReactNode): ReactNode {
  const children = Children.toArray(isValidElement(content) ? (content as ReactElement<{ children?: ReactNode }>).props.children : content)
  const firstVisual = children.findIndex((c) => !isHeadline(c))
  const notSpacer = (c: ReactNode) => !(isValidElement(c) && String((c.props as { className?: string }).className ?? '') === 'spacer')
  if (firstVisual < 0) return <div className="tv-solo">{children.filter(notSpacer)}</div>
  return (
    <>
      <div className="tv-left">{children.slice(0, firstVisual).filter(notSpacer)}</div>
      <div className="tv-right">{children.slice(firstVisual).filter(notSpacer)}</div>
    </>
  )
}

export default function SlideFrame({ slide, index, active, tv }: { slide: SlideDef; index: number; active: boolean; tv?: boolean }) {
  const t = slide.theme
  const style: CSSProperties = { background: t.bg, color: t.fg }
  return (
    <section className={`slide${t.dark ? ' on-dark' : ''}`} style={style} aria-hidden={!active}>
      {LAYOUTS[index % LAYOUTS.length](t.deco[0], t.deco[1])}
      <div className={`slide-body${active ? ' anim' : ''}${tv ? ' tv-split' : ''}`} key={active ? 'on' : 'off'}>
        {tv ? splitForTv(slide.content) : slide.content}
      </div>
    </section>
  )
}
