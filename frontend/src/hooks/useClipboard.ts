import { useState, useCallback } from 'react'
import { ClipboardCopy } from '../../wailsjs/go/backend/App'

export function useClipboard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copy = useCallback(async (value: string, key: string, timeoutSecs = 30) => {
    await ClipboardCopy(value, timeoutSecs)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }, [])

  return { copy, copiedKey }
}
