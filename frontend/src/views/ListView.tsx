import { useState, useEffect, useRef } from 'react'
import { useRecords } from '../hooks/useRecords'
import { RecordCard } from '../components/RecordCard'
import type { RecordSummary } from '../hooks/useRecords'

interface Props {
  onSelect: (id: string) => void
  onNew: () => void
  onTrash: () => void
  onSettings: () => void
  onLock: () => void
}

export function ListView({ onSelect, onNew, onTrash, onSettings, onLock }: Props) {
  const [query, setQuery] = useState('')
  const [records, setRecords] = useState<RecordSummary[]>([])
  const [loading, setLoading] = useState(true)
  const { list } = useRecords()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      if (cancelled) return
      const attempt = () => {
        if (cancelled) return
        try {
          list(query)
            .then((results) => {
              if (!cancelled) { setRecords(results ?? []); setLoading(false) }
            })
            .catch(() => {
              if (!cancelled) setLoading(false)
            })
        } catch {
          setTimeout(attempt, 100)
        }
      }
      attempt()
    }, 150)

    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, list])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <input
          type="text"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-3 py-1.5 bg-white text-gray-900 rounded-lg border border-gray-300
                     focus:outline-none focus:border-indigo-400 text-sm placeholder-gray-400
                     shadow-sm"
        />
        <button
          onClick={onNew}
          className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white
                     rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          + New
        </button>
        <button
          onClick={onTrash}
          className="flex-shrink-0 px-3 py-1.5 text-gray-400 hover:text-gray-700 transition-colors text-sm"
        >
          Trash
        </button>
      </div>

      {/* Record list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 relative">
        {loading && (
          <p className="text-center text-gray-400 text-sm mt-10">Loading…</p>
        )}
        {!loading && records.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-10">
            {query ? 'No records match your search.' : 'No records yet.'}
          </p>
        )}
        {records.map((r) => (
          <RecordCard key={r.id} record={r} onClick={onSelect} />
        ))}
      </div>

      {/* Bottom bar */}
      <div className="px-4 pb-4 flex justify-between">
        <button
          onClick={onSettings}
          className="px-3 py-1.5 text-gray-400 hover:text-gray-700 text-sm transition-colors"
        >
          Settings
        </button>
        <button
          onClick={onLock}
          className="px-3 py-1.5 text-gray-400 hover:text-gray-700 text-sm transition-colors"
        >
          Lock
        </button>
      </div>
    </div>
  )
}
