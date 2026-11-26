import type { FunnyMetric, FunnyMoment, Retro } from '../lib/stats'
import { FUNNY_METRICS } from '../lib/stats'
import { dateLong } from '../lib/format'
import ChatView from './ChatView'

export type MomentSets = Partial<Record<FunnyMetric, FunnyMoment[]>>

/** Tela de calibragem: os melhores momentos segundo cada critério, lado a lado. */
export default function Calibrate({ retro, sets, onDone }: { retro: Retro; sets: MomentSets; onDone: () => void }) {
  return (
    <main className="calib">
      <div className="calib-head">
        <div>
          <h2>Qual foi o momento mais engraçado?</h2>
          <p className="setup-sub">Os 3 primeiros de cada critério. Diga qual critério acertou mais.</p>
        </div>
        <button className="btn" onClick={onDone}>
          Ver a retrospectiva →
        </button>
      </div>
      {(Object.keys(FUNNY_METRICS) as FunnyMetric[]).map((metric) => (
        <section key={metric} className="calib-section">
          <h3>{FUNNY_METRICS[metric].label}</h3>
          <p className="hint">{FUNNY_METRICS[metric].description}</p>
          <div className="calib-row">
            {(sets[metric] ?? []).map((m, k) => (
              <div className="calib-card" key={k}>
                <div className="calib-stats">
                  <b>{k + 1}º</b> {dateLong(m.bubbles[m.trigger].ts, true)} · {m.laughers} pessoas · {m.laughs} risadas · {Math.round(m.purity * 100)}% risada ·
                  tamanho {Math.round(m.size)}
                </div>
                <ChatView moment={m} people={retro.people} group={retro.group} />
              </div>
            ))}
            {(sets[metric] ?? []).length === 0 && <p className="hint">Nenhum momento encontrado com esse critério.</p>}
          </div>
        </section>
      ))}
    </main>
  )
}
