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
      className="w-full text-left px-4 py-3 bg-white hover:bg-gray-50 rounded-xl
                 border border-gray-200 hover:border-gray-300 transition-colors shadow-sm"
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
  )
}
