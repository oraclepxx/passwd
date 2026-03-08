import { useState, useEffect } from 'react'
import { useRecords } from '../hooks/useRecords'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { RecordSummary } from '../hooks/useRecords'

interface Props {
  onBack: () => void
}

export function TrashView({ onBack }: Props) {
  const [records, setRecords] = useState<RecordSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmPurge, setConfirmPurge] = useState<string | null>(null)
  const { listTrash, restore, purge } = useRecords()

  const load = () => {
    listTrash()
      .then((results) => { setRecords(results ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleRestore = (id: string) => {
    restore(id).then(load)
  }

  const handlePurge = (id: string) => {
    purge(id).then(() => { setConfirmPurge(null); load() })
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-200">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-700 transition-colors text-sm"
        >
          ← Back
        </button>
        <h1 className="font-semibold text-gray-900 text-lg">Trash</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 pt-4">
        {loading && (
          <p className="text-center text-gray-400 text-sm mt-10">Loading…</p>
        )}
        {!loading && records.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-10">Trash is empty.</p>
        )}
        {records.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-gray-900 text-sm font-medium truncate">{r.name}</p>
              <p className="text-gray-400 text-xs font-mono truncate">{r.username_masked}</p>
            </div>
            <div className="flex gap-2 ml-3 flex-shrink-0">
              <button
                onClick={() => handleRestore(r.id)}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Restore
              </button>
              <button
                onClick={() => setConfirmPurge(r.id)}
                className="px-3 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmPurge && (
        <ConfirmDialog
          message={"Permanently delete this record?\nThis cannot be undone."}
          onConfirm={() => handlePurge(confirmPurge)}
          onCancel={() => setConfirmPurge(null)}
        />
      )}
    </div>
  )
}
