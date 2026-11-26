import { useMemo, useRef, useState } from 'react'
import type { ParsedChat } from '../lib/parser'
import { looksLikePhone } from '../lib/parser'
import { availablePeriods, type Period } from '../lib/stats'
import { num } from '../lib/format'
import { squarePhoto } from '../lib/photo'
import Avatar from './Avatar'

export interface SetupResult {
  group: string
  period: Period
  names: Record<string, string>
  photos: Record<string, string> // por autor original
  ai: boolean
}

interface Props {
  chat: ParsedChat
  group: string
  initialNames?: Record<string, string>
  initialPhotos?: Record<string, string>
  onBack: () => void
  onDone: (result: SetupResult) => void
}

export default function Setup({ chat, group: initialGroup, initialNames, initialPhotos, onBack, onDone }: Props) {
  const periods = useMemo(() => availablePeriods(chat.messages), [chat])
  const counts = useMemo(() => {
    const c = new Map<string, number>()
    for (const m of chat.messages) if (m.author) c.set(m.author, (c.get(m.author) ?? 0) + 1)
    return c
  }, [chat])
  const [group, setGroup] = useState(initialGroup)
  const [periodIdx, setPeriodIdx] = useState(0)
  const [names, setNames] = useState<Record<string, string>>(() => initialNames ?? Object.fromEntries(chat.authors.map((a) => [a, a])))

  const [photos, setPhotos] = useState<Record<string, string>>(initialPhotos ?? {})
  const [ai, setAi] = useState(() => {
    try {
      return localStorage.getItem('retro-ai') === '1'
    } catch {
      return false
    }
  })
  const toggleAi = (on: boolean) => {
    setAi(on)
    try {
      localStorage.setItem('retro-ai', on ? '1' : '0')
    } catch {
      // sem armazenamento local, só não lembra da escolha
    }
  }
  const photoInput = useRef<HTMLInputElement>(null)
  const [photoFor, setPhotoFor] = useState<string | null>(null)

  const pickPhoto = (author: string) => {
    setPhotoFor(author)
    photoInput.current?.click()
  }
  const onPhoto = async (file: File | undefined) => {
    if (!file || !photoFor) return
    try {
      const data = await squarePhoto(file, 160)
      setPhotos((prev) => ({ ...prev, [photoFor]: data }))
    } catch {
      // imagem que o navegador não consegue abrir; ignora
    }
  }

  const phones = chat.authors.filter((a) => looksLikePhone(names[a] ?? a))
  const merged = new Set<string>()
  const seen = new Map<string, number>()
  for (const a of chat.authors) {
    const n = (names[a] ?? a).trim().toLowerCase()
    seen.set(n, (seen.get(n) ?? 0) + 1)
  }
  for (const [n, c] of seen) if (c > 1) merged.add(n)

  if (periods.length === 0) {
    return (
      <main className="setup">
        <h2>Hmm, nada aqui</h2>
        <p className="setup-sub">Não encontrei mensagens nesse arquivo.</p>
        <button className="btn" onClick={onBack}>
          Voltar
        </button>
      </main>
    )
  }

  return (
    <main className="setup">
      <div>
        <h2>Quase lá</h2>
        <p className="setup-sub">
          Encontrei {num(chat.messages.filter((m) => m.author).length)} mensagens de {chat.authors.length} pessoas. Ajuste o que precisar.
        </p>
      </div>

      <label className="field">
        <span>Nome do grupo</span>
        <input className="input" value={group} onChange={(e) => setGroup(e.target.value)} maxLength={60} />
      </label>

      <label className="field">
        <span>Período</span>
        <select className="select" value={periodIdx} onChange={(e) => setPeriodIdx(Number(e.target.value))}>
          {periods.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span>Participantes</span>
        <p className="hint">
          Os nomes vêm como estão salvos no seu celular. Dá pra trocar por apelidos. Se duas linhas forem a mesma pessoa (trocou de número,
          por exemplo), coloque o mesmo nome nas duas que elas se juntam. Toque no círculo para escolher uma foto (opcional, o export não
          traz as fotos de perfil).
        </p>
        <div className="people-list">
          {chat.authors.map((a, i) => {
            const value = names[a] ?? a
            const phone = looksLikePhone(value)
            return (
              <div className="person-row" key={a}>
                <button className="avatar-btn" onClick={() => pickPhoto(a)} aria-label={`Escolher foto de ${value}`}>
                  <Avatar name={value} index={i} photo={photos[a]} size={44} />
                  {photos[a] && (
                    <span
                      className="avatar-x"
                      role="button"
                      aria-label="Tirar foto"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPhotos((prev) => {
                          const next = { ...prev }
                          delete next[a]
                          return next
                        })
                      }}
                    >
                      ✕
                    </span>
                  )}
                </button>
                <input
                  className={`input${phone ? ' warn' : ''}`}
                  value={value}
                  aria-label={`Nome para ${a}`}
                  maxLength={40}
                  onChange={(e) => setNames({ ...names, [a]: e.target.value })}
                />
                <small>
                  {num(counts.get(a) ?? 0)} msgs{merged.has(value.trim().toLowerCase()) ? ' · junto' : ''}
                </small>
              </div>
            )
          })}
        </div>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            onPhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {phones.length > 0 && (
          <p className="hint warn">
            {phones.length === 1 ? 'Tem um contato aparecendo' : `Tem ${phones.length} contatos aparecendo`} como número de telefone. Se
            gerar o link sem trocar o nome, o número aparece escondido.
          </p>
        )}
      </div>

      <label className="check ai-check">
        <input type="checkbox" checked={ai} onChange={(e) => toggleAi(e.target.checked)} />
        <span>
          Descobrir o assunto dos dias mais agitados com IA
          <small>
            Um modelo de IA roda aqui no seu aparelho e identifica o tema de cada dia (futebol, viagem, aniversário...). Na primeira vez
            ele baixa 118 MB; depois fica guardado. Nenhuma mensagem sai do aparelho, e quem abrir o link não precisa baixar nada.
          </small>
        </span>
      </label>

      <div className="setup-actions">
        <button
          className="btn"
          onClick={() =>
            onDone({
              group: group.trim() || initialGroup,
              period: periods[periodIdx],
              names: Object.fromEntries(chat.authors.map((a) => [a, (names[a] ?? a).trim() || a])),
              photos,
              ai,
            })
          }
        >
          Ver a retrospectiva
        </button>
        <button className="btn ghost" onClick={onBack}>
          Trocar arquivo
        </button>
      </div>
    </main>
  )
}
