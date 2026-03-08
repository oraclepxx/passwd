import { useState, useEffect, useRef, useCallback } from 'react'
import {
  VaultIsUnlocked,
  VaultCreate,
  VaultUnlock,
  VaultLock,
} from '../../wailsjs/go/backend/App'

const AUTO_LOCK_MS = 5 * 60 * 1000 // 5 minutes

export function useVault() {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check initial vault state on mount.
  // Default to locked (safe). If the vault session is somehow already unlocked
  // (e.g. HMR during dev), we update state after the bridge responds.
  useEffect(() => {
    let cancelled = false

    const check = () => {
      if (cancelled) return
      try {
        VaultIsUnlocked()
          .then((unlocked) => {
            if (!cancelled && unlocked) setIsUnlocked(true)
          })
          .catch(() => { /* stay locked */ })
      } catch {
        // Bridge not ready yet — retry shortly.
        setTimeout(check, 100)
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  // 6-2: Auto-lock — reset timer on any user interaction.
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      VaultLock().then(() => setIsUnlocked(false))
    }, AUTO_LOCK_MS)
  }, [])

  useEffect(() => {
    if (!isUnlocked) return
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart']
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isUnlocked, resetTimer])

  const createVault = useCallback(async (password: string) => {
    await VaultCreate(password)
    setIsUnlocked(true)
  }, [])

  const unlock = useCallback(async (password: string) => {
    await VaultUnlock(password)
    setIsUnlocked(true)
  }, [])

  const lock = useCallback(async () => {
    await VaultLock()
    setIsUnlocked(false)
  }, [])

  return { isUnlocked, createVault, unlock, lock }
}
