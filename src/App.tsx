import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { ActivityPage } from './pages/Activity'
import { FoodPage } from './pages/Food'
import { LiftsPage } from './pages/Lifts'
import { SettingsPage } from './pages/Settings'
import { SignIn } from './pages/SignIn'
import { WeighInPage } from './pages/WeighIn'
import { isConfigured, supabase, type Targets, type Unit } from './supabase'

const TABS = [
  { id: 'weight', label: 'Weigh-in', icon: '⚖️' },
  { id: 'lifts', label: 'Lifts', icon: '🏋️' },
  { id: 'food', label: 'Food', icon: '🍽️' },
  { id: 'activity', label: 'Activity', icon: '🏃' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
] as const
type Tab = (typeof TABS)[number]['id']

const NO_TARGETS: Targets = { kcal_target: null, protein_target_g: null, carbs_target_g: null, fat_target_g: null }

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>('weight')
  const [unit, setUnit] = useState<Unit>('lb')
  const [targets, setTargets] = useState<Targets>(NO_TARGETS)

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase
      .from('profiles')
      .select('weight_unit, kcal_target, protein_target_g, carbs_target_g, fat_target_g')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setUnit(data.weight_unit)
        setTargets({ ...NO_TARGETS, ...data })
      })
  }, [session])

  async function saveProfile(fields: Partial<Targets & { weight_unit: Unit }>) {
    await supabase.from('profiles').upsert({ ...fields, updated_at: new Date().toISOString() })
  }

  if (!isConfigured)
    return (
      <main className="signin">
        <h1>Almost there</h1>
        <p className="muted">The app isn't connected to its database yet.</p>
      </main>
    )
  if (!ready) return null
  if (!session) return <SignIn />

  return (
    <>
      <main>
        {tab === 'weight' && <WeighInPage unit={unit} />}
        {tab === 'lifts' && <LiftsPage unit={unit} />}
        {tab === 'food' && <FoodPage targets={targets} />}
        {tab === 'activity' && <ActivityPage />}
        {tab === 'settings' && (
          <SettingsPage
            email={session.user.email ?? ''}
            unit={unit}
            onUnit={(u) => {
              setUnit(u)
              saveProfile({ weight_unit: u })
            }}
            targets={targets}
            onTargets={(t) => {
              setTargets(t)
              saveProfile(t)
            }}
          />
        )}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  )
}
