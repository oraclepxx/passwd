import { useState, useEffect } from 'react'
import { useRecords } from '../hooks/useRecords'
import { useClipboard } from '../hooks/useClipboard'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { RecordDetail } from '../hooks/useRecords'

interface Props {
  id: string
  onEdit: () => void
  onBack: () => void
}

export function DetailView({ id, onEdit, onBack }: Props) {
  const { get, remove } = useRecords()
  const { copy, copiedKey } = useClipboard()
  const [record, setRecord] = useState<RecordDetail | null>(null)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showUsername, setShowUsername] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    let cancelled = false
    const attempt = () => {
      if (cancelled) return
      try {
        get(id)
          .then((r) => { if (!cancelled) setRecord(r) })
          .catch(() => { if (!cancelled) setError('Failed to load record.') })
      } catch {
        setTimeout(attempt, 100)
      }
    }
    attempt()
    return () => { cancelled = true }
  }, [id, get])

  if (error) {
    return (
      <div className="flex flex-col h-screen bg-gray-950 items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={onBack} className="mt-4 text-gray-400 hover:text-white text-sm">
          Back
        </button>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="flex h-screen bg-gray-950 items-center justify-center">
        <p className="text-gray-500 text-sm font-mono">Loading…</p>
      </div>
    )
  }

  const handleDelete = async () => {
    await remove(id)
    setShowConfirm(false)
    onBack()
  }

  const displayUsername = showUsername ? record.username : record.username_masked

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {showConfirm && (
        <ConfirmDialog
          message={`Delete "${record.name}"? This can be restored from trash.`}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-800">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        <h1 className="flex-1 font-semibold text-white text-base truncate">{record.name}</h1>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          className="px-3 py-1.5 text-sm bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          Delete
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Username */}
        <Field label="Username">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-white text-sm break-all font-mono">{displayUsername}</span>
            <button
              onClick={() => setShowUsername(!showUsername)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0"
            >
              {showUsername ? 'Hide' : 'Show'}
            </button>
            <CopyButton
              onCopy={() => copy(record.username, 'username')}
              copied={copiedKey === 'username'}
            />
          </div>
        </Field>

        {/* Password */}
        <Field label="Password">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-white text-sm break-all font-mono">
              {showPassword ? record.password : '••••••••'}
            </span>
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0"
            >
              {showPassword ? 'Hide' : 'Reveal'}
            </button>
            <CopyButton
              onCopy={() => copy(record.password, 'password')}
              copied={copiedKey === 'password'}
            />
          </div>
        </Field>

        {/* URL */}
        {record.url && (
          <Field label="URL">
            <span className="text-white text-sm break-all">{record.url}</span>
          </Field>
        )}

        {/* Notes */}
        {record.notes && (
          <Field label="Notes">
            <span className="text-white text-sm whitespace-pre-wrap">{record.notes}</span>
          </Field>
        )}

        {/* Tags */}
        {record.tags && record.tags.length > 0 && (
          <Field label="Tags">
            <div className="flex flex-wrap gap-2">
              {record.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Field>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      {children}
    </div>
  )
}

function CopyButton({ onCopy, copied }: { onCopy: () => void; copied: boolean }) {
  return (
    <button
      onClick={onCopy}
      className="text-xs text-gray-400 hover:text-white transition-colors flex-shrink-0"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
