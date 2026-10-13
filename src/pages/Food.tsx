import { useEffect, useMemo, useState } from 'react'
import { supabase, type Food, type FoodLog, type Targets } from '../supabase'
import { fmtDay, today } from '../units'

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
const r1 = (n: number) => Math.round(n * 10) / 10

function shiftDay(day: string, by: number) {
  const d = new Date(day + 'T12:00:00')
  d.setDate(d.getDate() + by)
  return d.toISOString().slice(0, 10)
}

export function FoodPage({ targets }: { targets: Targets }) {
  const [day, setDay] = useState(today())
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [adding, setAdding] = useState<string | null>(null) // meal being added to
  const [editingFood, setEditingFood] = useState<Food | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadLogs() {
    const { data, error } = await supabase
      .from('food_logs')
      .select('id, eaten_on, meal, food_id, name, servings, kcal, protein_g, carbs_g, fat_g')
      .eq('eaten_on', day)
      .order('created_at')
    if (error) setError(error.message)
    else setLogs(data as FoodLog[])
  }

  async function loadFoods() {
    const { data } = await supabase
      .from('foods')
      .select('id, name, brand, serving, kcal, protein_g, carbs_g, fat_g')
      .order('name')
    setFoods((data as Food[]) ?? [])
  }

  useEffect(() => {
    loadLogs()
  }, [day])

  useEffect(() => {
    loadFoods()
  }, [])

  const totals = logs.reduce(
    (t, l) => ({ kcal: t.kcal + l.kcal, p: t.p + l.protein_g, c: t.c + l.carbs_g, f: t.f + l.fat_g }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  )

  async function log(food: Food, servings: number, meal: string) {
    const { error } = await supabase.from('food_logs').insert({
      eaten_on: day,
      meal,
      food_id: food.id,
      name: food.name,
      servings,
      kcal: r1(food.kcal * servings),
      protein_g: r1(food.protein_g * servings),
      carbs_g: r1(food.carbs_g * servings),
      fat_g: r1(food.fat_g * servings),
    })
    if (error) return setError(error.message)
    setAdding(null)
    loadLogs()
  }

  async function removeLog(id: string) {
    setLogs(logs.filter((l) => l.id !== id))
    await supabase.from('food_logs').delete().eq('id', id)
  }

  if (editingFood)
    return (
      <FoodForm
        food={editingFood === 'new' ? null : editingFood}
        onDone={(saved) => {
          setEditingFood(null)
          loadFoods()
          if (saved && adding) log(saved, 1, adding)
        }}
      />
    )

  if (adding)
    return (
      <FoodPicker
        meal={adding}
        foods={foods}
        onPick={(f, servings) => log(f, servings, adding)}
        onNew={() => setEditingFood('new')}
        onEdit={(f) => setEditingFood(f)}
        onCancel={() => setAdding(null)}
      />
    )

  return (
    <section>
      <h1>Food</h1>
      <div className="row between day-nav">
        <button className="link" onClick={() => setDay(shiftDay(day, -1))}>
          ‹
        </button>
        <strong>{day === today() ? 'Today' : fmtDay(day)}</strong>
        <button className="link" disabled={day >= today()} onClick={() => setDay(shiftDay(day, 1))}>
          ›
        </button>
      </div>

      <div className="card">
        <Bar label="Calories" value={totals.kcal} target={targets.kcal_target} unit="kcal" />
        <Bar label="Protein" value={totals.p} target={targets.protein_target_g} unit="g" />
        <Bar label="Carbs" value={totals.c} target={targets.carbs_target_g} unit="g" />
        <Bar label="Fat" value={totals.f} target={targets.fat_target_g} unit="g" />
        {!targets.kcal_target && <p className="muted small">Set your daily targets in Settings.</p>}
      </div>

      {MEALS.map((meal) => {
        const items = logs.filter((l) => l.meal === meal)
        const kcal = items.reduce((s, l) => s + l.kcal, 0)
        return (
          <div key={meal}>
            <div className="row between">
              <h2>{meal}</h2>
              <span className="muted small">{Math.round(kcal)} kcal</span>
            </div>
            <ul className="list">
              {items.map((l) => (
                <li key={l.id}>
                  <div className="col">
                    <span>{l.name}</span>
                    <span className="muted small">
                      {l.servings !== 1 && `${l.servings} servings · `}P {r1(l.protein_g)} · C {r1(l.carbs_g)} · F{' '}
                      {r1(l.fat_g)}
                    </span>
                  </div>
                  <span className="small">{Math.round(l.kcal)}</span>
                  <button className="icon" aria-label="Remove" onClick={() => removeLog(l.id)}>
                    ×
                  </button>
                </li>
              ))}
              <li className="tap" onClick={() => setAdding(meal)}>
                <span className="accent">+ Add food</span>
              </li>
            </ul>
          </div>
        )
      })}
      {error && <p className="notice">{error}</p>}
    </section>
  )
}

function Bar({ label, value, target, unit }: { label: string; value: number; target: number | null; unit: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0
  const over = target !== null && value > target
  return (
    <div className="bar">
      <div className="row between small">
        <span>{label}</span>
        <span className={over ? 'notice' : 'muted'}>
          {Math.round(value)}
          {target ? ` / ${target}` : ''} {unit}
          {target ? ` · ${Math.max(0, Math.round(target - value))} left` : ''}
        </span>
      </div>
      <div className="track">
        <div className={over ? 'fill over' : 'fill'} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

type PickerProps = {
  meal: string
  foods: Food[]
  onPick: (f: Food, servings: number) => void
  onNew: () => void
  onEdit: (f: Food) => void
  onCancel: () => void
}

function FoodPicker({ meal, foods, onPick, onNew, onEdit, onCancel }: PickerProps) {
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<Food | null>(null)
  const [servings, setServings] = useState('1')

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return foods.filter((f) => words.every((w) => `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(w)))
  }, [foods, q])

  const n = parseFloat(servings) || 0

  return (
    <section>
      <div className="row between">
        <button className="link" onClick={onCancel}>
          ‹ Back
        </button>
        <button className="link" onClick={onNew}>
          + New food
        </button>
      </div>
      <h1>Add to {meal}</h1>

      {chosen ? (
        <div className="card">
          <strong>{chosen.name}</strong>
          <span className="muted small">
            1 serving = {chosen.serving} · {chosen.kcal} kcal
          </span>
          <label>
            Servings
            <input inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} autoFocus />
          </label>
          <p className="small">
            {Math.round(chosen.kcal * n)} kcal · P {r1(chosen.protein_g * n)}g · C {r1(chosen.carbs_g * n)}g · F{' '}
            {r1(chosen.fat_g * n)}g
          </p>
          <button className="primary" disabled={!(n > 0)} onClick={() => onPick(chosen, n)}>
            Add to {meal}
          </button>
          <button onClick={() => setChosen(null)}>Pick a different food</button>
        </div>
      ) : (
        <>
          <input placeholder="Search your foods" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <ul className="list spaced">
            {shown.map((f) => (
              <li key={f.id} className="tap" onClick={() => setChosen(f)}>
                <div className="col">
                  <span>{f.name}</span>
                  <span className="muted small">
                    {f.brand && `${f.brand} · `}
                    {f.serving} · P {f.protein_g} · C {f.carbs_g} · F {f.fat_g}
                  </span>
                </div>
                <span className="small">{f.kcal}</span>
                <button
                  className="icon"
                  aria-label="Edit food"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(f)
                  }}
                >
                  ✎
                </button>
              </li>
            ))}
            {!shown.length && (
              <li className="tap" onClick={onNew}>
                <span className="muted">
                  {foods.length ? 'No match.' : 'Your food library is empty.'}{' '}
                  <span className="accent">Add a new food</span>
                </span>
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  )
}

function FoodForm({ food, onDone }: { food: Food | null; onDone: (saved: Food | null) => void }) {
  const [f, setF] = useState({
    name: food?.name ?? '',
    brand: food?.brand ?? '',
    serving: food?.serving ?? '',
    kcal: food ? String(food.kcal) : '',
    protein_g: food ? String(food.protein_g) : '',
    carbs_g: food ? String(food.carbs_g) : '',
    fat_g: food ? String(food.fat_g) : '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const num = (s: string) => parseFloat(s) || 0
  const fromMacros = Math.round(num(f.protein_g) * 4 + num(f.carbs_g) * 4 + num(f.fat_g) * 9)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const row = {
      name: f.name.trim(),
      brand: f.brand.trim() || null,
      serving: f.serving.trim() || '1 serving',
      kcal: f.kcal ? num(f.kcal) : fromMacros,
      protein_g: num(f.protein_g),
      carbs_g: num(f.carbs_g),
      fat_g: num(f.fat_g),
    }
    const q = food
      ? supabase.from('foods').update(row).eq('id', food.id)
      : supabase.from('foods').insert(row)
    const { data, error } = await q.select('id, name, brand, serving, kcal, protein_g, carbs_g, fat_g').single()
    if (error) return setError(error.message)
    onDone(food ? null : (data as Food))
  }

  async function remove() {
    if (!food || !confirm(`Delete ${food.name} from your library? Past logs are kept.`)) return
    await supabase.from('foods').delete().eq('id', food.id)
    onDone(null)
  }

  return (
    <section>
      <div className="row between">
        <button className="link" onClick={() => onDone(null)}>
          ‹ Cancel
        </button>
        {food && (
          <button className="link danger" onClick={remove}>
            Delete
          </button>
        )}
      </div>
      <h1>{food ? 'Edit food' : 'New food'}</h1>
      <form className="card" onSubmit={save}>
        <label>
          Name
          <input value={f.name} onChange={set('name')} placeholder="e.g. Greek yogurt" required autoFocus />
        </label>
        <label>
          Brand (optional)
          <input value={f.brand} onChange={set('brand')} />
        </label>
        <label>
          Serving size
          <input value={f.serving} onChange={set('serving')} placeholder="e.g. 175 g, 1 cup, 2 slices" />
        </label>
        <p className="muted small">Nutrition for one serving, as on the label:</p>
        <div className="grid4">
          <label>
            Calories
            <input inputMode="decimal" value={f.kcal} onChange={set('kcal')} placeholder={String(fromMacros || '')} />
          </label>
          <label>
            Protein g
            <input inputMode="decimal" value={f.protein_g} onChange={set('protein_g')} />
          </label>
          <label>
            Carbs g
            <input inputMode="decimal" value={f.carbs_g} onChange={set('carbs_g')} />
          </label>
          <label>
            Fat g
            <input inputMode="decimal" value={f.fat_g} onChange={set('fat_g')} />
          </label>
        </div>
        <button className="primary" disabled={!f.name.trim()}>
          {food ? 'Save changes' : 'Save food'}
        </button>
        {error && <p className="notice">{error}</p>}
      </form>
    </section>
  )
}
