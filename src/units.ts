import type { Unit } from './supabase'

const LB_PER_KG = 2.2046226218

export const toDisplay = (kg: number, unit: Unit) => (unit === 'lb' ? kg * LB_PER_KG : kg)
export const toKg = (value: number, unit: Unit) => (unit === 'lb' ? value / LB_PER_KG : value)
export const fmtWeight = (kg: number, unit: Unit) => `${toDisplay(kg, unit).toFixed(1)} ${unit}`

// Local calendar date as YYYY-MM-DD (not UTC, so a late-evening entry stays on today)
export const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export const fmtDay = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
