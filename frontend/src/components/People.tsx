import type { Retro } from '../lib/stats'
import { firstName } from '../lib/format'
import Avatar from './Avatar'

/** As fotos de várias pessoas sobrepostas, como numa roda de amigos. */
export function AvatarStack({ r, people, size }: { r: Retro; people: number[]; size: number }) {
  return (
    <div className="avatar-stack">
      {people.map((i) => (
        <Avatar key={i} name={r.people[i]?.name ?? '?'} index={i} photo={r.people[i]?.photo} size={size} />
      ))}
    </div>
  )
}

/** Nome com a foto ao lado, para os destaques. */
export function Who({ r, i, full }: { r: Retro; i: number; full?: boolean }) {
  const p = r.people[i]
  return (
    <b className="with-avatar">
      <Avatar name={p?.name ?? '?'} index={i} photo={p?.photo} size={30} />
      {full ? p?.name : firstName(p?.name ?? '?')}
    </b>
  )
}
