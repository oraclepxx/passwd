import { useState } from 'react'
import { VaultChangeMasterPassword } from '../../wailsjs/go/backend/App'

interface Props {
  onBack: () => void
}

export function ChangePasswordView({ onBack }: Props) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!current) { setError('Current password is required'); return }
    if (next.length < 8) { setError('New password must be at least 8 characters'); return }
    if (next !== confirm) { setError('Passwords do not match'); return }

    setSaving(true)
    try {
      await VaultChangeMasterPassword(current, next)
      setDone(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('wrong') || msg.includes('Wrong') ? 'Current password is incorrect' : msg)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = `w-full px-3 py-2 bg-white text-gray-900 rounded-lg border border-gray-300
    hover:border-gray-400 focus:outline-none focus:border-indigo-400 text-sm placeholder-gray-400
    transition-colors shadow-sm`

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-200">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-400 hover:text-gray-700 transition-colors text-sm"
        >
          ← Back
        </button>
        <h1 className="font-semibold text-gray-900 text-sm">Change master password</h1>
        <div className="w-14" />
      </div>

      <div className="flex-1 flex items-center justify-center px-5">
        {done ? (
          <div className="text-center space-y-4">
            <p className="text-green-600 text-sm">Master password updated successfully.</p>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Back to list
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Current password</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoFocus
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">New password</label>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputCls}
              />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                         text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
