import { useState } from 'react'
import { supabase, type Targets, type Unit } from '../supabase'

type Props = {
  email: string
  unit: Unit
  onUnit: (u: Unit) => void
  targets: Targets
  onTargets: (t: Targets) => void
}

const FIELDS: [keyof Targets, string][] = [
  ['kcal_target', 'Calories'],
  ['protein_target_g', 'Protein g'],
  ['carbs_target_g', 'Carbs g'],
  ['fat_target_g', 'Fat g'],
]

export function SettingsPage({ email, unit, onUnit, targets, onTargets }: Props) {
  const [draft, setDraft] = useState(
    Object.fromEntries(FIELDS.map(([k]) => [k, targets[k] === null ? '' : String(targets[k])])) as Record<
      keyof Targets,
      string
    >,
  )
  const [saved, setSaved] = useState(false)

  function saveTargets(e: React.FormEvent) {
    e.preventDefault()
    const t = Object.fromEntries(
      FIELDS.map(([k]) => [k, draft[k] ? Math.round(parseFloat(draft[k])) : null]),
    ) as Targets
    onTargets(t)
    setSaved(true)
  }

  async function exportData() {
    const tables = ['weigh_ins', 'lift_sessions', 'lift_sets', 'foods', 'food_logs', 'workouts', 'daily_metrics', 'profiles'] as const
    const out: Record<string, unknown> = { exported_at: new Date().toISOString() }
    for (const t of tables) out[t] = (await supabase.from(t).select('*')).data
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fitness-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  return (
    <section>
      <h1>Settings</h1>
      <div className="card">
        <span className="muted small">Weight unit</span>
        <div className="segmented">
          {(['lb', 'kg'] as Unit[]).map((u) => (
            <button key={u} className={u === unit ? 'on' : ''} onClick={() => onUnit(u)}>
              {u}
            </button>
          ))}
        </div>
      </div>
      <form className="card" onSubmit={saveTargets}>
        <span className="muted small">Daily food targets</span>
        <div className="grid4">
          {FIELDS.map(([k, label]) => (
            <label key={k}>
              {label}
              <input
                inputMode="numeric"
                value={draft[k]}
                onChange={(e) => {
                  setDraft({ ...draft, [k]: e.target.value })
                  setSaved(false)
                }}
              />
            </label>
          ))}
        </div>
        <button className="primary">{saved ? 'Saved ✓' : 'Save targets'}</button>
      </form>
      <div className="card">
        <p className="muted small">Signed in as {email}</p>
        <button onClick={exportData}>Download a backup of my data</button>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </section>
  )
}
