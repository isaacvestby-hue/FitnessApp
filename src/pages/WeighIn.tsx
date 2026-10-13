import { useEffect, useMemo, useState } from 'react'
import { LineChart, movingAverage } from '../components/LineChart'
import { supabase, type Unit, type WeighIn } from '../supabase'
import { fmtDay, fmtWeight, toDisplay, toKg, today } from '../units'

const RANGES = { '30D': 30, '90D': 90, '1Y': 365, All: 0 } as const
type Range = keyof typeof RANGES

export function WeighInPage({ unit }: { unit: Unit }) {
  const [entries, setEntries] = useState<WeighIn[]>([])
  const [day, setDay] = useState(today())
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [range, setRange] = useState<Range>('30D')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data, error } = await supabase
      .from('weigh_ins')
      .select('id, measured_on, weight_kg, body_fat_pct, note')
      .order('measured_on', { ascending: false })
    if (error) setError(error.message)
    else setEntries(data as WeighIn[])
  }

  useEffect(() => {
    load()
  }, [])

  const existing = entries.find((e) => e.measured_on === day)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const value = parseFloat(weight)
    if (!(value > 0)) return
    setSaving(true)
    const { error } = await supabase.from('weigh_ins').upsert(
      {
        measured_on: day,
        weight_kg: Math.round(toKg(value, unit) * 100) / 100,
        body_fat_pct: bodyFat ? parseFloat(bodyFat) : null,
      },
      { onConflict: 'user_id,measured_on' },
    )
    setSaving(false)
    if (error) return setError(error.message)
    setWeight('')
    setBodyFat('')
    setError(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this weigh-in?')) return
    await supabase.from('weigh_ins').delete().eq('id', id)
    load()
  }

  const { points, trend, change } = useMemo(() => {
    const asc = [...entries].reverse()
    const days = RANGES[range]
    const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) : ''
    const all = asc.map((e) => ({ x: e.measured_on, y: toDisplay(e.weight_kg, unit) }))
    const avg = movingAverage(all, 7)
    const inRange = (p: { x: string }) => p.x >= cutoff
    const shown = avg.filter(inRange)
    const change = shown.length > 1 ? shown[shown.length - 1].y - shown[0].y : null
    return { points: all.filter(inRange), trend: shown, change }
  }, [entries, range, unit])

  const latest = entries[0]
  const latestAvg = trend.length ? trend[trend.length - 1].y : null

  return (
    <section>
      <h1>Weigh-in</h1>

      <form className="card" onSubmit={save}>
        <div className="row">
          <label className="grow">
            Weight ({unit})
            <input
              className="big"
              inputMode="decimal"
              placeholder={latest ? toDisplay(latest.weight_kg, unit).toFixed(1) : '0.0'}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            Body fat %
            <input inputMode="decimal" placeholder="opt." value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
          </label>
        </div>
        <label>
          Date
          <input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} />
        </label>
        <button className="primary" disabled={saving || !weight}>
          {existing ? `Update ${fmtDay(day)}` : 'Save weigh-in'}
        </button>
        {existing && <p className="muted small">Already logged {fmtWeight(existing.weight_kg, unit)} for this day.</p>}
        {error && <p className="notice">{error}</p>}
      </form>

      <div className="card">
        <div className="stats">
          <div>
            <span className="muted small">Latest</span>
            <strong>{latest ? fmtWeight(latest.weight_kg, unit) : '–'}</strong>
          </div>
          <div>
            <span className="muted small">7-day avg</span>
            <strong>{latestAvg ? `${latestAvg.toFixed(1)} ${unit}` : '–'}</strong>
          </div>
          <div>
            <span className="muted small">Change ({range})</span>
            <strong>{change === null ? '–' : `${change > 0 ? '+' : ''}${change.toFixed(1)}`}</strong>
          </div>
        </div>
        <div className="segmented">
          {(Object.keys(RANGES) as Range[]).map((r) => (
            <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
        <LineChart points={points} trend={trend} />
        <p className="muted small">Dots are daily weigh-ins; the line is your 7-day average.</p>
      </div>

      <h2>History</h2>
      <ul className="list">
        {entries.map((e) => (
          <li key={e.id}>
            <span>{fmtDay(e.measured_on)}</span>
            <span>
              {fmtWeight(e.weight_kg, unit)}
              {e.body_fat_pct !== null && <span className="muted"> · {e.body_fat_pct}%</span>}
            </span>
            <button className="icon" aria-label="Delete" onClick={() => remove(e.id)}>
              ×
            </button>
          </li>
        ))}
        {!entries.length && <li className="muted">No weigh-ins yet.</li>}
      </ul>
    </section>
  )
}
