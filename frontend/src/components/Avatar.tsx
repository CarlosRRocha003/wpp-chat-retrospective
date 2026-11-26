import { CARD_COLORS } from '../lib/card'
import { initials } from '../lib/photo'

interface Props {
  name: string
  index: number
  photo?: string
  size?: number
}

/** Foto da pessoa, ou as iniciais num círculo colorido. */
export default function Avatar({ name, index, photo, size = 48 }: Props) {
  const style = { width: size, height: size, fontSize: size * 0.38 }
  if (photo) return <img className="avatar" src={photo} alt="" style={style} />
  return (
    <span className="avatar" style={{ ...style, background: CARD_COLORS[index % CARD_COLORS.length] }} aria-hidden>
      {initials(name)}
    </span>
  )
}
