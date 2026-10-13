import { useState } from 'react'
import { supabase } from '../supabase'

export function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) setMessage(error.message)
    else if (mode === 'up' && !data.session)
      setMessage('Check your email to confirm your account, then sign in here.')
  }

  return (
    <main className="signin">
      <h1>Fitness</h1>
      <p className="muted">Your weight, workouts and food in one place.</p>
      <form onSubmit={submit} className="card">
        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        {message && <p className="notice">{message}</p>}
      </form>
      <button className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
        {mode === 'in' ? 'First time? Create your account' : 'Already have an account? Sign in'}
      </button>
    </main>
  )
}
