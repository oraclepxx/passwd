import type { RecordSummary } from '../hooks/useRecords'

interface Props {
  record: RecordSummary
  onClick: (id: string) => void
}

export function RecordCard({ record, onClick }: Props) {
  const isApiKey = record.type === 'api_key'

  return (
    <button
      onClick={() => onClick(record.id)}
      className="w-full text-left px-4 py-3 bg-gray-800 hover:bg-gray-750 rounded-xl
                 border border-gray-700 hover:border-gray-600 transition-colors group"
    >
      <div className="flex items-center gap-2">
        <p className="text-white font-medium text-sm truncate">{record.name}</p>
        <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs rounded font-medium
          ${isApiKey
            ? 'bg-amber-900/50 text-amber-400 border border-amber-700/50'
            : 'bg-indigo-900/50 text-indigo-400 border border-indigo-700/50'
          }`}>
          {isApiKey ? 'API Key' : 'Password'}
        </span>
      </div>
      {!isApiKey && record.username_masked && (
        <p className="text-gray-400 font-mono text-xs truncate mt-0.5">{record.username_masked}</p>
      )}
    </button>
  )
}
