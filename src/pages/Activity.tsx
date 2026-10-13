import { useEffect, useMemo, useState } from 'react'
import { LineChart } from '../components/LineChart'
import { supabase, type DailyMetrics, type Workout } from '../supabase'
import { fmtDay } from '../units'

type Metric = 'steps' | 'resting_hr' | 'sleep_hours' | 'vo2max'
const METRICS: Record<Metric, { label: string; fmt: (v: number) => string }> = {
  steps: { label: 'Steps', fmt: (v) => Math.round(v).toLocaleString() },
  resting_hr: { label: 'Resting HR', fmt: (v) => `${Math.round(v)}` },
  sleep_hours: { label: 'Sleep', fmt: (v) => `${v.toFixed(1)}h` },
  vo2max: { label: 'VO₂ max', fmt: (v) => v.toFixed(1) },
}

export function ActivityPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [daily, setDaily] = useState<DailyMetrics[]>([])
  const [metric, setMetric] = useState<Metric>('steps')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    supabase
      .from('workouts')
      .select('id, activity, started_at, duration_min, active_kcal, distance_km, avg_hr, max_hr, source')
      .order('started_at', { ascending: false })
      .then(({ data }) => setWorkouts((data as Workout[]) ?? []))
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    supabase
      .from('daily_metrics')
      .select('day, steps, active_kcal, resting_hr, hrv_ms, vo2max, sleep_hours')
      .gte('day', since)
      .order('day')
      .then(({ data }) => setDaily((data as DailyMetrics[]) ?? []))
  }, [])

  const activities = useMemo(() => ['All', ...new Set(workouts.map((w) => w.activity))], [workouts])
  const shown = filter === 'All' ? workouts : workouts.filter((w) => w.activity === filter)

  const points = daily
    .filter((d) => d[metric] !== null && (metric !== 'sleep_hours' || (d.sleep_hours ?? 0) > 2))
    .map((d) => ({ x: d.day, y: Number(d[metric]) }))
  const avg = points.length ? points.reduce((s, p) => s + p.y, 0) / points.length : null

  const weekAgo = Date.now() - 7 * 86400000
  const thisWeek = workouts.filter((w) => new Date(w.started_at).getTime() > weekAgo)

  return (
    <section>
      <h1>Activity</h1>

      <div className="card">
        <div className="stats">
          <div>
            <span className="muted small">Workouts this week</span>
            <strong>{thisWeek.length}</strong>
          </div>
          <div>
            <span className="muted small">Minutes</span>
            <strong>{Math.round(thisWeek.reduce((s, w) => s + (w.duration_min ?? 0), 0))}</strong>
          </div>
          <div>
            <span className="muted small">Active kcal</span>
            <strong>{Math.round(thisWeek.reduce((s, w) => s + (w.active_kcal ?? 0), 0))}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="segmented">
          {(Object.keys(METRICS) as Metric[]).map((m) => (
            <button key={m} className={m === metric ? 'on' : ''} onClick={() => setMetric(m)}>
              {METRICS[m].label}
            </button>
          ))}
        </div>
        <LineChart points={points} format={METRICS[metric].fmt} />
        <p className="muted small">
          Last 90 days{avg !== null && ` · average ${METRICS[metric].fmt(avg)}`}
        </p>
      </div>

      <div className="row between">
        <h2>Workouts</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {activities.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>
      <ul className="list">
        {shown.map((w) => (
          <li key={w.id} className="workout">
            <div>
              <strong>{w.activity}</strong>
              <span className="muted small">{fmtDay(w.started_at)}</span>
            </div>
            <div className="small right">
              {w.duration_min !== null && <span>{Math.round(w.duration_min)} min</span>}
              {w.distance_km !== null && w.distance_km > 0.05 && <span> · {w.distance_km.toFixed(2)} km</span>}
              <br />
              <span className="muted">
                {w.active_kcal !== null && `${Math.round(w.active_kcal)} kcal`}
                {w.avg_hr !== null && ` · ${Math.round(w.avg_hr)} bpm`}
              </span>
            </div>
          </li>
        ))}
        {!shown.length && <li className="muted">No workouts yet. Your Apple Watch history appears here once imported.</li>}
      </ul>
    </section>
  )
}
