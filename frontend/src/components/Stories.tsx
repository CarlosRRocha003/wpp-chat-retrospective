import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type MouseEvent } from 'react'
import type { FunnyCategory, Retro } from '../lib/stats'
import { stripForShare } from '../lib/stats'
import { looksLikePhone, maskPhone } from '../lib/parser'
import { drawPersonCard, drawSummaryCard, shareCanvas } from '../lib/card'
import { shareUrl } from '../lib/share'
import { squarePhoto, thumbnail, toDataUrl } from '../lib/photo'
import { uploadToVault, VaultRefused } from '../lib/vault'
import { buildPersonSlides, buildRankingSlides, buildSlides } from './slides'
import SlideFrame from './SlideFrame'

interface Props {
  retro: Retro
  shared: boolean
  onClose: () => void
  onNew: () => void
}

// No modo TV o slide é desenhado em 1600×900 e escalado para caber na tela
const TV_W = 1600
const TV_H = 900
const subscribeResize = (cb: () => void) => {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}
const tvScale = () => Math.min(window.innerWidth / TV_W, window.innerHeight / TV_H)

function slug(s: string) {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'grupo'
  )
}

export default function Stories({ retro: baseRetro, shared, onClose, onNew }: Props) {
  // Quem gerou pode trocar o momento engraçado de cada tipo entre as opções sugeridas
  const [funnyChoice, setFunnyChoice] = useState<Partial<Record<FunnyCategory, number>>>({})
  const retro = useMemo<Retro>(
    () => ({
      ...baseRetro,
      funnies: baseRetro.funnies.map((f) => {
        const choice = funnyChoice[f.category] ?? 0
        return { ...f, choice, moment: f.options?.[choice] ?? f.moment }
      }),
    }),
    [baseRetro, funnyChoice],
  )
  const nextFunny = useCallback(
    (category: FunnyCategory) =>
      setFunnyChoice((prev) => {
        const total = baseRetro.funnies.find((f) => f.category === category)?.options?.length ?? 1
        return { ...prev, [category]: ((prev[category] ?? 0) + 1) % total }
      }),
    [baseRetro],
  )
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<'main' | 'rankings' | 'person'>('main')
  const [tv, setTv] = useState(false)
  const scale = useSyncExternalStore(subscribeResize, tvScale)

  const toggleTv = useCallback(() => {
    const next = !tv
    setTv(next)
    // Tela cheia ajuda a espelhar na TV; se o navegador negar, o layout horizontal continua
    if (next) document.documentElement.requestFullscreen?.().catch(() => {})
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [tv])

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setTv(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const [personIdx, setPersonIdx] = useState(0)
  const [sharing, setSharing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const notify = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }, [])

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(location.href)
    notify('Link copiado')
  }, [notify])

  const saveCard = useCallback(
    async (i: number) => {
      const canvas = await drawPersonCard(retro, i)
      const how = await shareCanvas(canvas, `retrospectiva-${slug(retro.people[i]?.name ?? 'pessoa')}.png`)
      if (how === 'downloaded') notify('Imagem salva')
    },
    [retro, notify],
  )

  const saveSummary = useCallback(async () => {
    const canvas = await drawSummaryCard(retro)
    const how = await shareCanvas(canvas, `retrospectiva-${slug(retro.group)}.png`)
    if (how === 'downloaded') notify('Imagem salva')
  }, [retro, notify])

  const [mainSlides, rankingSlides, personSlides] = useMemo(() => {
    const handlers = {
      shared,
      onPerson: (i: number) => {
        setPersonIdx(i)
        setMode('person')
        setIndex(0)
      },
      onSaveCard: saveCard,
      onBackToPeople: () => {
        setMode('main')
        setIndex(main.findIndex((s) => s.id === 'end'))
      },
      onShare: () => setSharing(true),
      onSaveSummary: saveSummary,
      onCopyLink: copyLink,
      onNew,
      onNextFunny: nextFunny,
      onRankings: () => {
        setMode('rankings')
        setIndex(0)
      },
      onBack: () => {
        setMode('main')
        setIndex(main.findIndex((s) => s.id === 'awards'))
      },
    }
    const main = buildSlides(retro, handlers)
    return [main, buildRankingSlides(retro, handlers), buildPersonSlides(retro, personIdx, handlers)]
  }, [retro, shared, saveSummary, saveCard, copyLink, onNew, nextFunny, personIdx])
  const slides = mode === 'main' ? mainSlides : mode === 'rankings' ? rankingSlides : personSlides

  const backToMain = useCallback(() => {
    setMode('main')
    setIndex(mainSlides.findIndex((s) => s.id === 'end'))
  }, [mainSlides])

  const go = useCallback((delta: number) => setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + delta))), [slides.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sharing) {
        if (e.key === 'Escape') setSharing(false)
        return
      }
      // Passadores de slide costumam mandar PageDown/PageUp
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') go(1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1)
      if (e.key === 'f' || e.key === 'F') toggleTv()
      // Fora da sequência principal, Esc volta para a lista de pessoas em vez de fechar tudo
      if (e.key === 'Escape') {
        if (mode !== 'main') backToMain()
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose, sharing, toggleTv, mode, backToMain])

  const tap = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    go(e.clientX - rect.left < rect.width * 0.3 ? -1 : 1)
  }

  const slide = slides[index]

  return (
    <div className={`stage${tv ? ' tv' : ''}`}>
      <button className="side-nav prev" onClick={() => go(-1)} disabled={index === 0} aria-label="Anterior">
        ←
      </button>
      <div
        className="story"
        onClick={tap}
        style={tv ? { background: slide.theme.bg, width: TV_W, height: TV_H, transform: `scale(${scale})` } : { background: slide.theme.bg }}
      >
        {slides.map((s, i) =>
          Math.abs(i - index) <= 1 ? (
            <div key={s.id} style={{ visibility: i === index ? 'visible' : 'hidden' }}>
              <SlideFrame slide={s} index={i} active={i === index} tv={tv} />
            </div>
          ) : null,
        )}
        <div className="story-top" style={{ color: slide.theme.fg }}>
          <div className="progress" aria-label={`Slide ${index + 1} de ${slides.length}`}>
            {slides.map((s, i) => (
              <span key={s.id} className={i <= index ? 'done' : ''} />
            ))}
          </div>
          <div className="story-bar">
            {mode === 'main' ? (
              <span>{retro.group}</span>
            ) : (
              <button
                className="back-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  backToMain()
                }}
              >
                ← {mode === 'rankings' ? 'Rankings' : retro.people[personIdx]?.name}
                <small>voltar</small>
              </button>
            )}
            <span className="bar-actions">
              <button
                className="tv-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleTv()
                }}
                aria-label={tv ? 'Voltar para o formato de celular' : 'Modo TV: tela cheia na horizontal'}
                title={tv ? 'Voltar para o celular (F)' : 'Modo TV: tela cheia na horizontal (F)'}
              >
                {tv ? '📱 Sair do modo TV' : '📺 Modo TV'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
                aria-label="Fechar"
              >
                ✕
              </button>
            </span>
          </div>
        </div>
      </div>
      <button className="side-nav next" onClick={() => go(1)} disabled={index === slides.length - 1} aria-label="Próximo">
        →
      </button>

      {sharing && <ShareModal retro={retro} onClose={() => setSharing(false)} notify={notify} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

type ShareState =
  | { step: 'idle' }
  | { step: 'working' }
  | { step: 'done'; url: string; expiresAt?: number; fallback?: string }

function ShareModal({ retro, onClose, notify }: { retro: Retro; onClose: () => void; notify: (m: string) => void }) {
  const [excerpts, setExcerpts] = useState(true)
  const [words, setWords] = useState(true)
  const [photos, setPhotos] = useState(true)
  const [state, setState] = useState<ShareState>({ step: 'idle' })
  const phones = retro.people.filter((p) => looksLikePhone(p.name)).length
  const withPhoto = retro.people.filter((p) => p.photo).length
  const url = state.step === 'done' ? state.url : null

  // Mudou uma opção: o link gerado antes não vale mais
  const option = (set: (v: boolean) => void) => (e: { target: { checked: boolean } }) => {
    set(e.target.checked)
    setState({ step: 'idle' })
  }

  const base = () => {
    const r = stripForShare(retro, { excerpts, words })
    for (const p of r.people) {
      if (looksLikePhone(p.name)) p.name = maskPhone(p.name)
      if (!photos) delete p.photo
    }
    return r
  }
  const bubbles = (r: Retro) => [...r.funnies.flatMap((f) => f.moment.bubbles), ...r.people.flatMap((x) => x.funny?.bubbles ?? [])]

  const generate = async () => {
    setState({ step: 'working' })
    try {
      // Cofre: vai tudo, com a figurinha animada original, as fotos e os áudios
      const r = base()
      for (const b of bubbles(r)) {
        if (b.media) b.media = await toDataUrl(b.media)
        if (b.audio) b.audio = await toDataUrl(b.audio)
      }
      const { url, expiresAt } = await uploadToVault(r)
      setState({ step: 'done', url, expiresAt })
    } catch (e) {
      console.warn('Cofre indisponível:', e)
      const reason = e instanceof VaultRefused ? e.message + ' ' : 'Não consegui guardar no cofre agora. '
      // Sem o cofre: tudo dentro do link, com miniaturas paradas e sem áudio
      const r = base()
      for (const p of r.people) if (p.photo) p.photo = await squarePhoto(p.photo, 64, 0.6)
      for (const b of bubbles(r)) {
        if (b.media) b.media = await thumbnail(b.media, 120, 0.6)
        delete b.audio
      }
      setState({
        step: 'done',
        url: await shareUrl(r),
        fallback: reason + 'Por enquanto gerei o link simples: funciona, mas as figurinhas ficam paradas e os áudios não vão.',
      })
    }
  }

  const copy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    notify('Link copiado')
  }
  const share = async () => {
    if (!url) return
    try {
      await navigator.share({ title: `Retrospectiva: ${retro.group}`, text: `A retrospectiva do ${retro.group} saiu 👀`, url })
    } catch {
      // cancelado
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Link para o grupo</h3>
        <p className="hint" style={{ fontSize: 14 }}>
          A retrospectiva é criptografada aqui no seu aparelho e guardada num cofre que não consegue lê-la: a chave vai só no link. Quem
          tiver o link vê tudo, então mande só pra quem é do grupo. O link expira em 90 dias.
        </p>
        <label className="check">
          <input type="checkbox" checked={excerpts} onChange={option(setExcerpts)} />
          <span>
            Incluir trechos de conversa
            <small>Os momentos engraçados (com figurinhas e áudios) e a primeira e a última mensagem do ano.</small>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={words} onChange={option(setWords)} />
          <span>
            Incluir bordões
            <small>As palavras que cada pessoa mais usa.</small>
          </span>
        </label>
        {withPhoto > 0 && (
          <label className="check">
            <input type="checkbox" checked={photos} onChange={option(setPhotos)} />
            <span>
              Incluir as fotos
              <small>{withPhoto === 1 ? 'A foto escolhida para uma pessoa.' : `As ${withPhoto} fotos escolhidas para as pessoas.`}</small>
            </span>
          </label>
        )}
        {phones > 0 && (
          <p className="hint warn">
            {phones === 1 ? 'Um contato sem nome vai aparecer' : `${phones} contatos sem nome vão aparecer`} só com os 4 últimos dígitos.
          </p>
        )}
        {state.step !== 'done' ? (
          <button className="btn" onClick={generate} disabled={state.step === 'working'}>
            {state.step === 'working' ? 'Criptografando e guardando…' : 'Gerar link'}
          </button>
        ) : (
          <>
            <div className="link-box">{state.url}</div>
            {state.expiresAt && <p className="hint">O link funciona até {new Date(state.expiresAt).toLocaleDateString('pt-BR')}.</p>}
            {state.fallback && <p className="hint warn">{state.fallback}</p>}
            <div className="modal-row">
              <button className="btn" onClick={copy}>
                Copiar link
              </button>
              {'share' in navigator && (
                <button className="btn ghost" onClick={share}>
                  Compartilhar
                </button>
              )}
            </div>
          </>
        )}
        <button className="btn ghost small" onClick={onClose} style={{ justifySelf: 'start' }}>
          Fechar
        </button>
      </div>
    </div>
  )
}
