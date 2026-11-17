import { CALENDAR_START, type SaleSchedule } from './catalog.ts'

export const calendarMinute = (time: number): number => CALENDAR_START + time

export const clockOf = (time: number) => {
  const minute = calendarMinute(time)
  return {
    day: Math.floor(minute / 1440) + 1,
    hour: Math.floor((minute % 1440) / 60),
    minute: Math.floor(minute % 60),
  }
}

const PI = 3.141592653589793

const cosSeries = (x: number): number => {
  const xx = x * x
  let term = 1
  let sum = 1
  for (let n = 2; n <= 20; n += 2) {
    term *= -xx / ((n - 1) * n)
    sum += term
  }
  return sum
}
const sinSeries = (x: number): number => {
  const xx = x * x
  let term = x
  let sum = x
  for (let n = 3; n <= 21; n += 2) {
    term *= -xx / ((n - 1) * n)
    sum += term
  }
  return sum
}

export const cosTurns = (turns: number): number => {
  const t = turns - Math.floor(turns)
  const half = t > 0.5 ? 1 - t : t
  const sign = half > 0.25 ? -1 : 1
  const quarter = half > 0.25 ? 0.5 - half : half
  return quarter > 0.125
    ? sign * sinSeries((0.25 - quarter) * 2 * PI)
    : sign * cosSeries(quarter * 2 * PI)
}

export const saleOf = (
  time: number,
  sale: SaleSchedule,
): Readonly<{ on: boolean; startsIn: number }> => {
  const minute = calendarMinute(time)
  const cycle = sale.everyDays * 1_440
  const ran = Math.floor((minute - sale.startMinute) / cycle)
  const on = ran >= 1 && minute < ran * cycle + sale.startMinute + sale.minutes
  const next = Math.max(1, Math.ceil((minute - sale.startMinute) / cycle))
  return { on, startsIn: on ? 0 : next * cycle + sale.startMinute - minute }
}
