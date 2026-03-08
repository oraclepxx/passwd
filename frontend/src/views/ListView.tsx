import { useState, useEffect, useRef } from 'react'
import { useRecords } from '../hooks/useRecords'
import { RecordCard } from '../components/RecordCard'
import type { RecordSummary } from '../hooks/useRecords'

interface Props {
  onSelect: (id: string) => void
  onNew: () => void
  onTrash: () => void
  onLock: () => void
}

export function ListView({ onSelect, onNew, onTrash, onLock }: Props) {
  const [query, setQuery] = useState('')
  const [records, setRecords] = useState<RecordSummary[]>([])
  const [loading, setLoading] = useState(true)
  const { list } = useRecords()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 7-3: Debounced search — call RecordList 150ms after last keystroke.
  // Uses retry pattern: if bridge throws synchronously, retry after 100ms.
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
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        {/* 7-3: Search bar */}
        <input
          type="text"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg border border-gray-700
                     focus:outline-none focus:border-indigo-500 text-sm placeholder-gray-500"
        />
        {/* 7-5: New record button */}
        <button
          onClick={onNew}
          className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white
                     rounded-lg text-sm font-medium transition-colors"
        >
          + New
        </button>
        <button
          onClick={onTrash}
          className="flex-shrink-0 px-3 py-1.5 text-gray-400 hover:text-white transition-colors text-sm"
        >
          Trash
        </button>
      </div>

      {/* 7-4: Record list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 relative">
        {loading && (
          <p className="text-center text-gray-500 text-sm mt-10">Loading…</p>
        )}
        {!loading && records.length === 0 && (
          <p className="text-center text-gray-500 text-sm mt-10">
            {query ? 'No records match your search.' : 'No records yet.'}
          </p>
        )}
        {/* 7-6: Clicking a card navigates to DetailView */}
        {records.map((r) => (
          <RecordCard key={r.id} record={r} onClick={onSelect} />
        ))}
      </div>

      {/* Lock button — bottom right */}
      <div className="px-4 pb-4 flex justify-end">
        <button
          onClick={onLock}
          className="px-3 py-1.5 text-gray-500 hover:text-white text-sm transition-colors"
        >
          Lock
        </button>
      </div>
    </div>
  )
}
