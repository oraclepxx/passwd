import { useState, useCallback } from 'react'
import { PasswordGenerate } from '../../wailsjs/go/backend/App'

interface Props {
  value: string
  onChange: (value: string) => void
  error?: string
}

export function PasswordField({ value, onChange, error }: Props) {
  const [show, setShow] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [length, setLength] = useState(20)
  const [useSymbols, setUseSymbols] = useState(true)
  const [useNumbers, setUseNumbers] = useState(true)
  const [useUppercase, setUseUppercase] = useState(true)
  const [generating, setGenerating] = useState(false)

  const generate = useCallback(async () => {
    setGenerating(true)
    try {
      const pwd = await PasswordGenerate({
        length,
        use_symbols: useSymbols,
        use_numbers: useNumbers,
        use_uppercase: useUppercase,
      })
      onChange(pwd)
      setShow(true)
    } finally {
      setGenerating(false)
    }
  }, [length, useSymbols, useNumbers, useUppercase, onChange])

  return (
    <div className="space-y-1.5">
      <div className={`flex items-center bg-white rounded-lg border shadow-sm transition-colors
                       ${error ? 'border-red-400' : 'border-gray-300 hover:border-gray-400'}`}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Password"
          className="flex-1 px-3 py-2 bg-transparent text-gray-900 font-mono text-sm
                     focus:outline-none placeholder-gray-400 min-w-0"
        />
        <div className="flex items-center gap-1 pr-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700 transition-colors rounded"
          >
            {show ? 'Hide' : 'Show'}
          </button>
          <div className="w-px h-3 bg-gray-200" />
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className={`px-2 py-1 text-xs transition-colors rounded
                        ${showOptions ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-700'}`}
          >
            Generate
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      {showOptions && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-xs w-14">Length</span>
            <input
              type="range"
              min={8}
              max={64}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-gray-700 text-xs w-6 text-right font-mono">{length}</span>
          </div>

          <div className="flex gap-4">
            <Toggle label="A–Z" value={useUppercase} onChange={setUseUppercase} />
            <Toggle label="0–9" value={useNumbers} onChange={setUseNumbers} />
            <Toggle label="!@#" value={useSymbols} onChange={setUseSymbols} />
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                       text-white text-xs rounded-lg font-medium transition-colors"
          >
            {generating ? 'Generating…' : 'Generate password'}
          </button>
        </div>
      )}
    </div>
  )
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-indigo-500"
      />
      <span className="text-gray-600 text-xs">{label}</span>
    </label>
  )
}
