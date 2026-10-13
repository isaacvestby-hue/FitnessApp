import { supabase, type Unit } from '../supabase'

type Props = { email: string; unit: Unit; onUnit: (u: Unit) => void }

export function SettingsPage({ email, unit, onUnit }: Props) {
  async function exportData() {
    const tables = ['weigh_ins', 'workouts', 'daily_metrics', 'profiles'] as const
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
      <div className="card">
        <p className="muted small">Signed in as {email}</p>
        <button onClick={exportData}>Download a backup of my data</button>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </section>
  )
}
