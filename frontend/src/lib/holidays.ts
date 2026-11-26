// Datas comemorativas brasileiras, para dar uma pista do porquê de um dia agitado

function easter(year: number): Date {
  // Algoritmo de Meeus/Jones/Butcher
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function secondSunday(year: number, month: number): number {
  const first = new Date(year, month, 1).getDay()
  return 1 + ((7 - first) % 7) + 7
}

const FIXED: Record<string, string> = {
  '1-1': 'Ano Novo',
  '21-4': 'Tiradentes',
  '1-5': 'Dia do Trabalho',
  '12-6': 'Dia dos Namorados',
  '24-6': 'São João',
  '7-9': 'Independência',
  '12-10': 'Dia das Crianças',
  '31-10': 'Halloween',
  '2-11': 'Finados',
  '15-11': 'Proclamação da República',
  '20-11': 'Consciência Negra',
  '24-12': 'Véspera de Natal',
  '25-12': 'Natal',
  '31-12': 'Réveillon',
}

export function holidayName(ts: number): string | null {
  const d = new Date(ts)
  const y = d.getFullYear()
  const fixed = FIXED[`${d.getDate()}-${d.getMonth() + 1}`]
  if (fixed) return fixed

  const sameDay = (x: Date) => x.getMonth() === d.getMonth() && x.getDate() === d.getDate()
  const e = easter(y)
  const shift = (days: number) => new Date(y, e.getMonth(), e.getDate() + days)
  // Eleições em anos pares: 1º turno no primeiro domingo de outubro, 2º turno no último
  if (y % 2 === 0 && d.getMonth() === 9 && d.getDay() === 0) {
    if (d.getDate() <= 7) return 'Eleição (1º turno)'
    if (d.getDate() + 7 > 31) return 'Eleição (2º turno)'
  }
  if (sameDay(e)) return 'Páscoa'
  if (sameDay(shift(-2))) return 'Sexta-feira Santa'
  if (sameDay(shift(-47)) || sameDay(shift(-48))) return 'Carnaval'
  if (sameDay(shift(-46))) return 'Quarta de Cinzas'
  if (d.getMonth() === 4 && d.getDate() === secondSunday(y, 4)) return 'Dia das Mães'
  if (d.getMonth() === 7 && d.getDate() === secondSunday(y, 7)) return 'Dia dos Pais'
  return null
}
