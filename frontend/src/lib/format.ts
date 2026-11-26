export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const num = (n: number) => Math.round(n).toLocaleString('pt-BR')

export function dateLong(ts: number, withYear = false): string {
  const d = new Date(ts)
  const base = `${d.getDate()} de ${MONTHS_FULL[d.getMonth()]}`
  return withYear ? `${base} de ${d.getFullYear()}` : base
}

export function dateShort(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthFull(label: string): string {
  const i = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'].indexOf(label)
  return i >= 0 ? MONTHS_FULL[i] : label
}

export const hourLabel = (h: number) => `${h}h`

export function firstName(name: string): string {
  if (/^[+\d]/.test(name)) return name
  return name.split(/\s+/)[0]
}

export function plural(n: number, one: string, many: string): string {
  return `${num(n)} ${n === 1 ? one : many}`
}

export function gapLabel(ms: number): string {
  const hours = ms / 3_600_000
  if (hours < 48) return plural(Math.round(hours), 'hora', 'horas')
  return plural(Math.round(hours / 24), 'dia', 'dias')
}

/** "uma mensagem a cada 7 minutos" */
export function paceLabel(messages: number, days: number): string {
  if (messages === 0) return ''
  const minutes = (days * 24 * 60) / messages
  if (minutes < 1) return `${num(messages / (days * 24 * 60))} mensagens por minuto`
  if (minutes < 60) return `uma mensagem a cada ${plural(Math.round(minutes), 'minuto', 'minutos')}`
  const hours = minutes / 60
  if (hours < 24) return `uma mensagem a cada ${plural(Math.round(hours), 'hora', 'horas')}`
  return `uma mensagem a cada ${plural(Math.round(hours / 24), 'dia', 'dias')}`
}

export function clock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
