import { useEffect, useRef } from 'react'
import type { FunnyMoment, PersonStats } from '../lib/stats'
import { clock, dateShort } from '../lib/format'

// Cores de nome legíveis sobre o balão claro
const NAME_COLORS = ['#1f7a5a', '#b4441f', '#4a37d6', '#b0306f', '#8a5a00', '#1c6f9c', '#6b3fa0', '#2d7d1e', '#a03535', '#00707a']

const MEDIA_LABEL: Partial<Record<string, string>> = {
  sticker: '🃏 Figurinha',
  audio: '🎙️ Áudio',
  image: '📷 Foto',
  video: '🎥 Vídeo',
  gif: '🎞️ GIF',
  document: '📄 Documento',
  deleted: '🚫 Mensagem apagada',
  poll: '📊 Enquete',
  location: '📍 Localização',
  contact: '👤 Contato',
}

/** Uma tela de conversa com as mensagens de um momento. */
export default function ChatView({ moment, people, group }: { moment: FunnyMoment; people: PersonStats[]; group: string }) {
  const body = useRef<HTMLDivElement>(null)
  // Abre com a mensagem destacada à vista (sem rolar a página, só o chat)
  useEffect(() => {
    const el = body.current
    const trigger = el?.querySelector<HTMLElement>('.bubble.trigger')
    if (el && trigger) el.scrollTop = Math.max(0, trigger.offsetTop - el.clientHeight / 3)
  }, [moment])
  return (
    <div className="chat" onClick={(e) => e.stopPropagation()}>
      <div className="chat-head">
        <b>{group}</b>
        <span>{dateShort(moment.bubbles[moment.trigger].ts)}</span>
      </div>
      <div className="chat-body" ref={body}>
        {moment.bubbles.map((b, k) => {
          const sticker = b.kind === 'sticker' && !!b.media
          return (
            <div className={`bubble${k === moment.trigger ? ' trigger' : ''}${sticker ? ' sticker' : ''}`} key={b.ts + '-' + k}>
              <b style={{ color: NAME_COLORS[b.person % NAME_COLORS.length] }}>{people[b.person]?.name ?? '?'}</b>
              {b.media && <img className="bubble-media" src={b.media} alt={MEDIA_LABEL[b.kind] ?? ''} />}
              {b.audio && <audio className="bubble-audio" controls preload="metadata" src={b.audio} />}
              {(b.text || (!b.media && !b.audio)) && <span className="bubble-text">{b.text ?? MEDIA_LABEL[b.kind] ?? '📎 Mídia'}</span>}
              <small>{clock(b.ts)}</small>
            </div>
          )
        })}
      </div>
    </div>
  )
}
