import type { RecordSummary } from '../hooks/useRecords'

interface Props {
  record: RecordSummary
  onClick: (id: string) => void
}

export function RecordCard({ record, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(record.id)}
      className="w-full text-left px-4 py-3 bg-gray-800 hover:bg-gray-750 rounded-xl
                 border border-gray-700 hover:border-gray-600 transition-colors group"
    >
      <p className="text-white font-medium text-sm truncate">{record.name}</p>
      <p className="text-gray-400 font-mono text-xs truncate mt-0.5">{record.username_masked}</p>
    </button>
  )
}
