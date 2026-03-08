import { useState, useRef, useEffect } from 'react'
import type { RecordSummary } from '../hooks/useRecords'

interface Props {
  record: RecordSummary
  onClick: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function RecordCard({ record, onClick, onEdit, onDelete }: Props) {
  const isApiKey = record.type === 'api_key'
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <div className="relative flex items-center bg-white hover:bg-gray-50 rounded-xl
                    border border-gray-200 hover:border-gray-300 transition-colors shadow-sm group">
      {/* Main clickable area */}
      <button
        onClick={() => onClick(record.id)}
        className="flex-1 text-left px-4 py-3 min-w-0"
      >
        <div className="flex items-center gap-2">
          <p className="text-gray-900 font-medium text-sm truncate">{record.name}</p>
          <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs rounded font-medium
            ${isApiKey
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}>
            {isApiKey ? 'API Key' : 'Password'}
          </span>
        </div>
        {!isApiKey && record.username_masked && (
          <p className="text-gray-400 font-mono text-xs truncate mt-0.5">{record.username_masked}</p>
        )}
      </button>

      {/* ⋮ menu button */}
      <div ref={menuRef} className="relative flex-shrink-0 pr-2">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
          className="p-1.5 text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-100
                     transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Actions"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="7" cy="2" r="1.3" />
            <circle cx="7" cy="7" r="1.3" />
            <circle cx="7" cy="12" r="1.3" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-28 bg-white border border-gray-200
                          rounded-lg shadow-lg z-10 py-1 text-sm">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(record.id) }}
              className="w-full text-left px-3 py-1.5 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(record.id) }}
              className="w-full text-left px-3 py-1.5 text-red-500 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
