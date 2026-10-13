import { useEffect, useMemo, useState } from 'react'
import { EXERCISES } from '../exercises'
import { supabase, type LiftSession, type LiftSet, type Unit } from '../supabase'
import { fmtDay, toDisplay, toKg, today } from '../units'

const round = (n: number) => Math.round(n * 10) / 10

// Group a session's sets by exercise, keeping the order exercises were added.
function byExercise(sets: LiftSet[]) {
  const groups = new Map<string, LiftSet[]>()
  for (const s of [...sets].sort((a, b) => a.position - b.position)) {
    groups.set(s.exercise, [...(groups.get(s.exercise) ?? []), s])
  }
  return [...groups.entries()]
}

const volumeKg = (sets: LiftSet[]) => sets.reduce((v, s) => v + s.reps * s.weight_kg, 0)

export function LiftsPage({ unit }: { unit: Unit }) {
  const [sessions, setSessions] = useState<LiftSession[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('lift_sessions')
      .select('id, performed_on, name, note, lift_sets(id, session_id, exercise, position, reps, weight_kg)')
      .order('performed_on', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setSessions(data as LiftSession[])
  }

  useEffect(() => {
    load()
  }, [])

  async function startSession() {
    const { data, error } = await supabase
      .from('lift_sessions')
      .insert({ performed_on: today() })
      .select('id, performed_on, name, note')
      .single()
    if (error) return setError(error.message)
    setSessions([{ ...data, lift_sets: [] }, ...sessions])
    setOpenId(data.id)
  }

  const open = sessions.find((s) => s.id === openId)
  if (open)
    return (
      <SessionEditor
        session={open}
        history={sessions.filter((s) => s.id !== open.id)}
        unit={unit}
        onChange={(s) => setSessions(sessions.map((x) => (x.id === s.id ? s : x)))}
        onDelete={() => {
          setSessions(sessions.filter((x) => x.id !== open.id))
          setOpenId(null)
        }}
        onClose={() => {
          setOpenId(null)
          load()
        }}
      />
    )

  return (
    <section>
      <h1>Lifts</h1>
      <button className="primary wide" onClick={startSession}>
        + Start a workout
      </button>
      {error && <p className="notice">{error}</p>}

      <h2>History</h2>
      <ul className="list">
        {sessions.map((s) => {
          const groups = byExercise(s.lift_sets)
          return (
            <li key={s.id} className="tap" onClick={() => setOpenId(s.id)}>
              <div className="col">
                <strong>{s.name || 'Workout'}</strong>
                <span className="muted small">
                  {fmtDay(s.performed_on)} · {groups.length} exercise{groups.length === 1 ? '' : 's'} · {s.lift_sets.length} set{s.lift_sets.length === 1 ? '' : 's'}
                </span>
                <span className="muted small clip">{groups.map(([e]) => e).join(', ')}</span>
              </div>
              <span className="small right">
                {Math.round(toDisplay(volumeKg(s.lift_sets), unit)).toLocaleString()} {unit}
                <br />
                <span className="muted">volume</span>
              </span>
            </li>
          )
        })}
        {!sessions.length && <li className="muted">No lifting sessions yet.</li>}
      </ul>
    </section>
  )
}

type EditorProps = {
  session: LiftSession
  history: LiftSession[]
  unit: Unit
  onChange: (s: LiftSession) => void
  onDelete: () => void
  onClose: () => void
}

function SessionEditor({ session, history, unit, onChange, onDelete, onClose }: EditorProps) {
  const [newExercise, setNewExercise] = useState('')
  const [error, setError] = useState<string | null>(null)
  const groups = byExercise(session.lift_sets)

  const known = useMemo(() => {
    const used = history.flatMap((s) => s.lift_sets.map((x) => x.exercise))
    return [...new Set([...used, ...EXERCISES])]
  }, [history])

  // Most recent earlier session's sets for an exercise, for "last time".
  function lastTime(exercise: string) {
    for (const s of history) {
      if (s.performed_on > session.performed_on) continue
      const sets = s.lift_sets.filter((x) => x.exercise === exercise).sort((a, b) => a.position - b.position)
      if (sets.length) return { day: s.performed_on, sets }
    }
    return null
  }

  async function update(fields: Partial<LiftSession>) {
    onChange({ ...session, ...fields })
    const { error } = await supabase.from('lift_sessions').update(fields).eq('id', session.id)
    if (error) setError(error.message)
  }

  async function addSet(exercise: string) {
    const mine = session.lift_sets.filter((s) => s.exercise === exercise)
    const prev = mine[mine.length - 1] ?? lastTime(exercise)?.sets[0]
    const position = session.lift_sets.length ? Math.max(...session.lift_sets.map((s) => s.position)) + 1 : 0
    const { data, error } = await supabase
      .from('lift_sets')
      .insert({
        session_id: session.id,
        exercise,
        position,
        reps: prev?.reps ?? 8,
        weight_kg: prev?.weight_kg ?? 0,
      })
      .select('id, session_id, exercise, position, reps, weight_kg')
      .single()
    if (error) return setError(error.message)
    onChange({ ...session, lift_sets: [...session.lift_sets, data] })
  }

  async function saveSet(set: LiftSet, fields: Partial<LiftSet>) {
    onChange({ ...session, lift_sets: session.lift_sets.map((s) => (s.id === set.id ? { ...s, ...fields } : s)) })
    const { error } = await supabase.from('lift_sets').update(fields).eq('id', set.id)
    if (error) setError(error.message)
  }

  async function removeSet(set: LiftSet) {
    onChange({ ...session, lift_sets: session.lift_sets.filter((s) => s.id !== set.id) })
    await supabase.from('lift_sets').delete().eq('id', set.id)
  }

  async function deleteSession() {
    if (!confirm('Delete this whole workout?')) return
    await supabase.from('lift_sessions').delete().eq('id', session.id)
    onDelete()
  }

  function addExercise(e: React.FormEvent) {
    e.preventDefault()
    const name = newExercise.trim()
    if (!name) return
    // match the casing of a known exercise if the user typed it differently
    const match = known.find((k) => k.toLowerCase() === name.toLowerCase()) ?? name
    setNewExercise('')
    addSet(match)
  }

  return (
    <section>
      <div className="row between">
        <button className="link" onClick={onClose}>
          ‹ Done
        </button>
        <button className="link danger" onClick={deleteSession}>
          Delete
        </button>
      </div>

      <div className="card">
        <input
          className="title-input"
          placeholder="Workout name (e.g. Push day)"
          defaultValue={session.name ?? ''}
          onBlur={(e) => e.target.value !== (session.name ?? '') && update({ name: e.target.value || null })}
        />
        <input
          type="date"
          value={session.performed_on}
          max={today()}
          onChange={(e) => update({ performed_on: e.target.value })}
        />
      </div>

      {groups.map(([exercise, sets]) => {
        const last = lastTime(exercise)
        return (
          <div className="card" key={exercise}>
            <div className="col">
              <strong>{exercise}</strong>
              {last && (
                <span className="muted small">
                  Last time ({fmtDay(last.day)}):{' '}
                  {last.sets.map((s) => `${round(toDisplay(s.weight_kg, unit))}×${s.reps}`).join(', ')}
                </span>
              )}
            </div>
            <div className="sets">
              <span className="muted small">Set</span>
              <span className="muted small">{unit}</span>
              <span className="muted small">Reps</span>
              <span />
              {sets.map((s, i) => (
                <SetRow
                  key={s.id}
                  index={i + 1}
                  set={s}
                  unit={unit}
                  onSave={(f) => saveSet(s, f)}
                  onRemove={() => removeSet(s)}
                />
              ))}
            </div>
            <button onClick={() => addSet(exercise)}>+ Add set</button>
          </div>
        )
      })}

      <form className="card" onSubmit={addExercise}>
        <label>
          Add exercise
          <input
            list="exercise-list"
            placeholder="Search or type a new one"
            value={newExercise}
            onChange={(e) => setNewExercise(e.target.value)}
          />
        </label>
        <datalist id="exercise-list">
          {known.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
        <button className="primary" disabled={!newExercise.trim()}>
          Add
        </button>
      </form>

      <textarea
        className="card note"
        placeholder="Notes"
        defaultValue={session.note ?? ''}
        onBlur={(e) => e.target.value !== (session.note ?? '') && update({ note: e.target.value || null })}
      />
      {error && <p className="notice">{error}</p>}
    </section>
  )
}

type SetRowProps = {
  index: number
  set: LiftSet
  unit: Unit
  onSave: (f: Partial<LiftSet>) => void
  onRemove: () => void
}

function SetRow({ index, set, unit, onSave, onRemove }: SetRowProps) {
  const [weight, setWeight] = useState(String(round(toDisplay(set.weight_kg, unit))))
  const [reps, setReps] = useState(String(set.reps))

  return (
    <>
      <span className="set-no">{index}</span>
      <input
        inputMode="decimal"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          const v = parseFloat(weight)
          if (v >= 0) onSave({ weight_kg: Math.round(toKg(v, unit) * 100) / 100 })
        }}
      />
      <input
        inputMode="numeric"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          const v = parseInt(reps)
          if (v >= 0) onSave({ reps: v })
        }}
      />
      <button className="icon" aria-label="Remove set" onClick={onRemove}>
        ×
      </button>
    </>
  )
}
