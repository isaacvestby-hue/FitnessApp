import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { ActivityPage } from './pages/Activity'
import { SettingsPage } from './pages/Settings'
import { SignIn } from './pages/SignIn'
import { WeighInPage } from './pages/WeighIn'
import { isConfigured, supabase, type Unit } from './supabase'

const TABS = [
  { id: 'weight', label: 'Weigh-in', icon: '⚖️' },
  { id: 'activity', label: 'Activity', icon: '🏃' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>('weight')
  const [unit, setUnit] = useState<Unit>('lb')

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
      .select('weight_unit')
      .maybeSingle()
      .then(({ data }) => data && setUnit(data.weight_unit))
  }, [session])

  async function changeUnit(u: Unit) {
    setUnit(u)
    await supabase.from('profiles').upsert({ weight_unit: u, updated_at: new Date().toISOString() })
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
        {tab === 'activity' && <ActivityPage />}
        {tab === 'settings' && <SettingsPage email={session.user.email ?? ''} unit={unit} onUnit={changeUnit} />}
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
