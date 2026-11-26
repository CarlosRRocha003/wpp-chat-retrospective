import { useState } from 'react'
import type { Retro } from '../lib/stats'
import { awardInfo } from '../lib/awards'
import { firstName } from '../lib/format'
import Avatar from './Avatar'

/** Os prêmios de cada um; tocar num cartão mostra por que a pessoa ganhou. */
export default function AwardsGrid({ retro }: { retro: Retro }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="awards" onClick={(e) => e.stopPropagation()}>
      {retro.awards.map((a) => {
        const info = awardInfo(a, retro)
        const p = retro.people[a.person]
        const isOpen = open === a.person
        return (
          <button
            className={`award${isOpen ? ' open' : ''}`}
            key={a.person}
            onClick={() => setOpen(isOpen ? null : a.person)}
            aria-expanded={isOpen}
          >
            <div className="award-top">
              <Avatar name={p?.name ?? '?'} index={a.person} photo={p?.photo} size={isOpen ? 52 : 40} />
              <span className="e">{info.emoji}</span>
            </div>
            <b>{info.title}</b>
            <span className="award-who">{isOpen ? p?.name : firstName(p?.name ?? '?')}</span>
            {isOpen && <span className="award-why">{info.description}</span>}
          </button>
        )
      })}
    </div>
  )
}
