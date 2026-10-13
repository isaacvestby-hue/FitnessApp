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

export type LiftSet = {
  id: string
  session_id: string
  exercise: string
  position: number
  reps: number
  weight_kg: number
}

export type LiftSession = {
  id: string
  performed_on: string
  name: string | null
  note: string | null
  lift_sets: LiftSet[]
}

export type Food = {
  id: string
  name: string
  brand: string | null
  serving: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export type FoodLog = {
  id: string
  eaten_on: string
  meal: string
  food_id: string | null
  name: string
  servings: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export type Targets = {
  kcal_target: number | null
  protein_target_g: number | null
  carbs_target_g: number | null
  fat_target_g: number | null
}
