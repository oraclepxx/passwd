import { useState, useEffect } from 'react'
import { VaultIsUnlocked } from '../../wailsjs/go/backend/App'

interface Props {
  onUnlocked: () => void
  createVault: (password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
}

export function LockView({ onUnlocked, createVault, unlock }: Props) {
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Determine first launch by checking if vault exists.
  // Poll until the Wails bridge is ready.
  useEffect(() => {
    let cancelled = false

    const detect = () => {
      if (cancelled) return
      try {
        VaultIsUnlocked()
          .then((unlocked) => {
            if (cancelled) return
            if (unlocked) { onUnlocked(); return }
            // VaultExists is available at runtime even before bindings are regenerated.
            const exists: Promise<boolean> = (window as unknown as Record<string, Record<string, Record<string, Record<string, () => Promise<boolean>>>>>)['go']['backend']['App']['VaultExists']()
            exists.then((vaultExists) => {
              if (!cancelled) setIsFirstLaunch(!vaultExists)
            }).catch(() => {
              if (!cancelled) setIsFirstLaunch(false)
            })
          })
          .catch(() => setTimeout(detect, 100))
      } catch {
        setTimeout(detect, 100)
      }
    }

    detect()
    return () => { cancelled = true }
  }, [onUnlocked])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (isFirstLaunch) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
      if (password !== confirm) {
        setError('Passwords do not match.')
        return
      }
    }

    setLoading(true)
    try {
      if (isFirstLaunch) {
        await createVault(password)
      } else {
        await unlock(password)
      }
      onUnlocked()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (isFirstLaunch === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">
        <p className="font-mono text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <div className="w-full max-w-sm px-8 py-10 bg-gray-900 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-mono font-semibold text-white text-center mb-1">
          passwd
        </h1>
        <p className="text-center text-gray-400 text-sm mb-8">
          {isFirstLaunch ? 'Create your vault' : 'Unlock your vault'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Master password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700
                         focus:outline-none focus:border-indigo-500 font-mono text-sm"
            />
          </div>

          {isFirstLaunch && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700
                           focus:outline-none focus:border-indigo-500 font-mono text-sm"
              />
            </div>
          )}

          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                       text-white rounded-lg font-medium text-sm transition-colors"
          >
            {loading ? 'Please wait…' : isFirstLaunch ? 'Create vault' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
