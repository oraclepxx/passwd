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
  const [showSecret, setShowSecret] = useState(false)
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
      <div className="flex flex-col h-screen bg-gray-50 items-center justify-center">
        <p className="text-red-500 text-sm">{error}</p>
        <button onClick={onBack} className="mt-4 text-gray-500 hover:text-gray-700 text-sm">Back</button>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  const isApiKey = record.type === 'api_key'

  const handleDelete = async () => {
    await remove(id)
    setShowConfirm(false)
    onBack()
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {showConfirm && (
        <ConfirmDialog
          message={`Delete "${record.name}"? \nThis can be restored from trash.`}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-200">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700 transition-colors text-sm">
          ← Back
        </button>
        <h1 className="font-semibold text-gray-900 text-sm truncate max-w-xs">{record.name}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={onEdit}
            className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto py-6 px-5">
        <div className="max-w-md mx-auto space-y-3">

          {!isApiKey && (
            <Field label="Username">
              <div className="flex items-center bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors shadow-sm">
                <span className="flex-1 px-3 py-2 text-gray-900 text-sm font-mono break-all min-w-0 text-left">
                  {showUsername ? record.username : record.username_masked}
                </span>
                <div className="flex items-center gap-1 pr-2 flex-shrink-0">
                  <button
                    onClick={() => setShowUsername(!showUsername)}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700 transition-colors rounded"
                  >
                    {showUsername ? 'Hide' : 'Show'}
                  </button>
                  <div className="w-px h-3 bg-gray-200" />
                  <button
                    onClick={() => copy(record.username ?? '', 'username')}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700 transition-colors rounded"
                  >
                    {copiedKey === 'username' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </Field>
          )}

          <Field label={isApiKey ? 'Key / Token' : 'Password'}>
            <div className="flex items-center bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors shadow-sm">
              <span className="flex-1 px-3 py-2 text-gray-900 text-sm font-mono min-w-0 text-left break-all">
                {showSecret
                  ? (isApiKey ? record.secret_key : record.password)
                  : '••••••••'}
              </span>
              <div className="flex items-center gap-1 pr-2 flex-shrink-0">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700 transition-colors rounded"
                >
                  {showSecret ? 'Hide' : 'Reveal'}
                </button>
                <div className="w-px h-3 bg-gray-200" />
                <button
                  onClick={() => copy(
                    (isApiKey ? record.secret_key : record.password) ?? '',
                    'secret'
                  )}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700 transition-colors rounded"
                >
                  {copiedKey === 'secret' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </Field>

          <div className="pt-1 border-t border-gray-200" />

          {!isApiKey && (
            <Field label="URL">
              <div className="px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm break-all min-h-[36px] text-gray-900 text-left shadow-sm">
                {record.url || <span className="text-gray-300">—</span>}
              </div>
            </Field>
          )}

          <Field label="Notes">
            <div className="px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm whitespace-pre-wrap min-h-[36px] text-gray-900 text-left shadow-sm">
              {record.notes || <span className="text-gray-300">—</span>}
            </div>
          </Field>

          <Field label="Tags">
            <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-white rounded-lg border border-gray-200 min-h-[36px] justify-start shadow-sm">
              {record.tags && record.tags.length > 0
                ? record.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {tag}
                    </span>
                  ))
                : <span className="text-gray-300 text-sm">—</span>
              }
            </div>
          </Field>

        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-left text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
