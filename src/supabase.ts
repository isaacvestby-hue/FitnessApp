import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder',
)

export type WeighIn = {
  id: string
  measured_on: string
  weight_kg: number
  body_fat_pct: number | null
  note: string | null
}

export type Workout = {
  id: string
  activity: string
  started_at: string
  duration_min: number | null
  active_kcal: number | null
  distance_km: number | null
  avg_hr: number | null
  max_hr: number | null
  source: string
}

export type DailyMetrics = {
  day: string
  steps: number | null
  active_kcal: number | null
  resting_hr: number | null
  hrv_ms: number | null
  vo2max: number | null
  sleep_hours: number | null
}

export type Unit = 'lb' | 'kg'
