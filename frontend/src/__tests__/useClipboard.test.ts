import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockClipboardCopy = vi.fn()
vi.mock('../../wailsjs/go/backend/App', () => ({
  ClipboardCopy: (...args: unknown[]) => mockClipboardCopy(...args),
}))

import { useClipboard } from '../hooks/useClipboard'

describe('useClipboard', () => {
  beforeEach(() => {
    mockClipboardCopy.mockReset()
    mockClipboardCopy.mockResolvedValue(undefined)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('copiedKey is null initially', () => {
    const { result } = renderHook(() => useClipboard())
    expect(result.current.copiedKey).toBeNull()
  })

  it('sets copiedKey after copy', async () => {
    const { result } = renderHook(() => useClipboard())
    await act(async () => {
      await result.current.copy('secret-value', 'password')
    })
    expect(result.current.copiedKey).toBe('password')
    expect(mockClipboardCopy).toHaveBeenCalledWith('secret-value', 30)
  })

  it('clears copiedKey after 2 seconds', async () => {
    const { result } = renderHook(() => useClipboard())
    await act(async () => {
      await result.current.copy('value', 'username')
    })
    expect(result.current.copiedKey).toBe('username')

    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current.copiedKey).toBeNull()
  })

  it('copiedKey resets before 2 seconds have passed', async () => {
    const { result } = renderHook(() => useClipboard())
    await act(async () => {
      await result.current.copy('value', 'password')
    })
    act(() => { vi.advanceTimersByTime(1999) })
    expect(result.current.copiedKey).toBe('password')
  })

  it('calls ClipboardCopy with 30s timeout', async () => {
    const { result } = renderHook(() => useClipboard())
    await act(async () => {
      await result.current.copy('my-secret', 'secret')
    })
    expect(mockClipboardCopy).toHaveBeenCalledWith('my-secret', 30)
  })
})
