import { useCallback, useEffect, useState } from 'react'
import { groupNameFromFile, parseChat, type ParsedChat } from './lib/parser'
import { readChatFile } from './lib/zip'
import { computeRetro, funnyMoments, FUNNY_METRICS, type ChatBubble, type FunnyMetric, type FunnyPick, type Retro } from './lib/stats'
import { thumbnail } from './lib/photo'
import Calibrate, { type MomentSets } from './components/Calibrate'
import { decodeRetro, payloadFromHash } from './lib/share'
import { openFromVault, vaultLinkFromHash, VaultNotFound } from './lib/vault'
import { generateSampleChat } from './lib/sample'
import { findTopics } from './lib/ai'
import Home from './components/Home'
import Setup, { type SetupResult } from './components/Setup'
import Stories from './components/Stories'

interface Loaded {
  chat: ParsedChat
  group: string
  media?: (name: string) => Promise<Blob | null>
  names?: Record<string, string>
  photos?: Record<string, string>
}

type View =
  | { name: 'home'; error?: string }
  | { name: 'loading'; label: string; progress?: number; hint?: string }
  | { name: 'setup'; loaded: Loaded }
  | { name: 'stories'; retro: Retro; shared: boolean; loaded?: Loaded }
  | { name: 'calibrate'; retro: Retro; sets: MomentSets; loaded: Loaded }

/** Aplica os nomes escolhidos; nomes iguais (ignorando maiúsculas) viram a mesma pessoa. */
function applyNames(chat: ParsedChat, names: Record<string, string>): ParsedChat {
  const canonical = new Map<string, string>()
  const resolve = (a: string) => {
    const wanted = names[a] ?? a
    const key = wanted.toLowerCase()
    if (!canonical.has(key)) canonical.set(key, wanted)
    return canonical.get(key)!
  }
  const messages = chat.messages.map((m) => (m.author ? { ...m, author: resolve(m.author) } : m))
  return { messages, authors: [...new Set(chat.authors.map(resolve))] }
}

/** Busca no zip as figurinhas e fotos das mensagens que vão aparecer numa tela de chat. */
async function attachMedia(bubbles: ChatBubble[], media: Loaded['media']) {
  if (!media) return
  for (const b of bubbles) {
    if (!b.file || (b.kind !== 'sticker' && b.kind !== 'image' && b.kind !== 'audio')) continue
    try {
      const blob = await media(b.file)
      if (!blob) continue
      // Áudio do WhatsApp é Ogg/Opus; vira um endereço local para o player tocar
      if (b.kind === 'audio') b.audio = URL.createObjectURL(new Blob([blob], { type: 'audio/ogg; codecs=opus' }))
      // Figurinha pode ser animada: usa o arquivo original (o link leva só uma miniatura parada)
      else if (b.kind === 'sticker') b.media = URL.createObjectURL(new Blob([blob], { type: 'image/webp' }))
      else b.media = await thumbnail(blob, 240)
    } catch {
      // arquivo que o navegador não abre: fica só o rótulo
    }
  }
}

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view.name])

  // Link compartilhado: #r=...
  useEffect(() => {
    const load = async () => {
      const vault = vaultLinkFromHash(location.hash)
      const payload = payloadFromHash(location.hash)
      if (!vault && !payload) return
      setView({ name: 'loading', label: 'Abrindo a retrospectiva…' })
      try {
        const retro = vault ? await openFromVault(vault.id, vault.key) : await decodeRetro(payload!)
        setView({ name: 'stories', retro, shared: true })
      } catch (e) {
        history.replaceState(null, '', location.pathname)
        const message =
          e instanceof VaultNotFound ? e.message + ' Peça pra gerarem de novo.' : 'Esse link parece estar quebrado ou incompleto. Peça pra mandarem de novo.'
        setView({ name: 'home', error: message })
      }
    }
    load()
    window.addEventListener('hashchange', load)
    return () => window.removeEventListener('hashchange', load)
  }, [])

  const openText = useCallback((text: string, group: string, media?: Loaded['media']) => {
    const chat = parseChat(text)
    if (chat.authors.length === 0) {
      setView({
        name: 'home',
        error: 'Não reconheci mensagens nesse arquivo. Confere se é o .txt (ou .zip) gerado em "Exportar conversa".',
      })
      return
    }
    setView({ name: 'setup', loaded: { chat, group: chat.groupName ?? group, media } })
  }, [])

  const onFile = useCallback(
    async (file: File) => {
      setView({ name: 'loading', label: 'Lendo a conversa…' })
      try {
        const source = await readChatFile(file)
        // Deixa a tela de carregamento aparecer antes do processamento pesado
        await new Promise((r) => setTimeout(r, 30))
        openText(source.text, groupNameFromFile(file.name), source.media)
      } catch (e) {
        setView({ name: 'home', error: (e as Error).message || 'Não consegui abrir esse arquivo.' })
      }
    },
    [openText],
  )

  const onSample = useCallback(() => {
    openText(generateSampleChat(), 'Grupo de exemplo')
  }, [openText])

  const onSetupDone = useCallback((loaded: Loaded, result: SetupResult) => {
    setView({ name: 'loading', label: 'Calculando…' })
    setTimeout(async () => {
      const chat = applyNames(loaded.chat, result.names)
      const retro = computeRetro(chat.messages, result.group, result.period)
      // As fotos foram escolhidas por autor original; liga ao nome final (que pode ter juntado pessoas)
      const photoByName = new Map<string, string>()
      for (const [author, photo] of Object.entries(result.photos)) {
        const key = (result.names[author] ?? author).toLowerCase()
        if (!photoByName.has(key)) photoByName.set(key, photo)
      }
      retro.people.forEach((p) => {
        const photo = photoByName.get(p.name.toLowerCase())
        if (photo) p.photo = photo
      })
      if (result.ai) {
        setView({ name: 'loading', label: 'Preparando a IA…', progress: 0 })
        try {
          await findTopics(chat.messages, retro, (p) =>
            setView(
              p.stage === 'download'
                ? { name: 'loading', label: 'Baixando o modelo de IA…', progress: p.fraction, hint: 'Só na primeira vez. Depois fica guardado no navegador.' }
                : { name: 'loading', label: 'Descobrindo os assuntos…', hint: 'Tudo aqui no seu aparelho.' },
            ),
          )
        } catch (e) {
          // Sem a IA a retrospectiva continua igual, só sem os temas
          console.warn('IA indisponível:', e)
        }
      }
      for (const f of retro.funnies) for (const m of f.options ?? [f.moment]) await attachMedia(m.bubbles, loaded.media)
      // Slide de áudio ou figurinha só faz sentido se o arquivo veio junto (export "com mídia" em .zip)
      retro.funnies = retro.funnies.flatMap((f): FunnyPick[] => {
        const options = (f.options ?? [f.moment]).filter((m) => {
          const t = m.bubbles[m.trigger]
          return f.category === 'geral' || (f.category === 'audio' ? !!t.audio : !!t.media)
        })
        return options.length ? [{ ...f, moment: options[0], options }] : []
      })
      for (const p of retro.people) if (p.funny) await attachMedia(p.funny.bubbles, loaded.media)
      const nextLoaded = { ...loaded, group: result.group, names: result.names, photos: result.photos }

      // ?calibrar: mostra os melhores momentos de cada critério antes da retrospectiva
      if (new URLSearchParams(location.search).has('calibrar')) {
        const idx = new Map(retro.people.map((p, i) => [p.name, i]))
        const inPeriod = chat.messages.filter((m) => m.author !== null && m.ts >= result.period.start && m.ts < result.period.end)
        const sets: MomentSets = {}
        for (const metric of Object.keys(FUNNY_METRICS) as FunnyMetric[]) {
          sets[metric] = funnyMoments(inPeriod, idx, retro.people.length, metric, 3)
          for (const m of sets[metric]!) await attachMedia(m.bubbles, loaded.media)
        }
        setView({ name: 'calibrate', retro, sets, loaded: nextLoaded })
        return
      }
      setView({ name: 'stories', retro, shared: false, loaded: nextLoaded })
    }, 30)
  }, [])

  const goHome = useCallback(() => {
    if (location.hash) history.replaceState(null, '', location.pathname)
    setView({ name: 'home' })
  }, [])

  switch (view.name) {
    case 'home':
      return <Home error={view.error} onFile={onFile} onSample={onSample} />
    case 'loading':
      return (
        <div className="loading">
          <div>
            <div className="spinner" />
            {view.label}
            {view.progress !== undefined && (
              <div className="progressbar" aria-label={`${Math.round(view.progress * 100)}%`}>
                <i style={{ width: `${Math.round(view.progress * 100)}%` }} />
              </div>
            )}
            {view.hint && <p className="loading-hint">{view.hint}</p>}
          </div>
        </div>
      )
    case 'setup':
      return (
        <Setup
          chat={view.loaded.chat}
          group={view.loaded.group}
          initialNames={view.loaded.names}
          initialPhotos={view.loaded.photos}
          onBack={goHome}
          onDone={(result) => onSetupDone(view.loaded, result)}
        />
      )
    case 'calibrate':
      return <Calibrate retro={view.retro} sets={view.sets} onDone={() => setView({ name: 'stories', retro: view.retro, shared: false, loaded: view.loaded })} />
    case 'stories':
      return (
        <Stories
          retro={view.retro}
          shared={view.shared}
          onClose={() => (view.loaded ? setView({ name: 'setup', loaded: view.loaded }) : goHome())}
          onNew={goHome}
        />
      )
  }
}
