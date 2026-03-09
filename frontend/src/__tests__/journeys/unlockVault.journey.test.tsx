import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const m = vi.hoisted(() => ({
  VaultIsUnlocked: vi.fn(),
  VaultCreate: vi.fn(),
  VaultUnlock: vi.fn(),
  VaultLock: vi.fn(),
  VaultExists: vi.fn(),
  VaultChangeMasterPassword: vi.fn(),
  RecordList: vi.fn(),
  RecordGet: vi.fn(),
  RecordCreate: vi.fn(),
  RecordUpdate: vi.fn(),
  RecordDelete: vi.fn(),
  RecordRestore: vi.fn(),
  RecordPurge: vi.fn(),
  RecordListTrash: vi.fn(),
  ClipboardCopy: vi.fn(),
  PasswordGenerate: vi.fn(),
}))

vi.mock('../../../wailsjs/go/backend/App', () => ({
  VaultIsUnlocked: (...a: unknown[]) => m.VaultIsUnlocked(...a),
  VaultCreate: (...a: unknown[]) => m.VaultCreate(...a),
  VaultUnlock: (...a: unknown[]) => m.VaultUnlock(...a),
  VaultLock: (...a: unknown[]) => m.VaultLock(...a),
  VaultExists: (...a: unknown[]) => m.VaultExists(...a),
  VaultChangeMasterPassword: (...a: unknown[]) => m.VaultChangeMasterPassword(...a),
  RecordList: (...a: unknown[]) => m.RecordList(...a),
  RecordGet: (...a: unknown[]) => m.RecordGet(...a),
  RecordCreate: (...a: unknown[]) => m.RecordCreate(...a),
  RecordUpdate: (...a: unknown[]) => m.RecordUpdate(...a),
  RecordDelete: (...a: unknown[]) => m.RecordDelete(...a),
  RecordRestore: (...a: unknown[]) => m.RecordRestore(...a),
  RecordPurge: (...a: unknown[]) => m.RecordPurge(...a),
  ClipboardCopy: (...a: unknown[]) => m.ClipboardCopy(...a),
  PasswordGenerate: (...a: unknown[]) => m.PasswordGenerate(...a),
}))

import App from '../../App'

const mockVaultExists = vi.fn()
const mockRecordListTrash = vi.fn()

describe('Journey: Unlock Vault', () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset())

    // Default behaviors — returning user scenario
    m.VaultIsUnlocked.mockResolvedValue(false)
    m.VaultCreate.mockResolvedValue(undefined)
    m.VaultUnlock.mockResolvedValue(undefined)
    m.VaultLock.mockResolvedValue(undefined)
    m.VaultExists.mockResolvedValue(true)
    m.RecordList.mockResolvedValue([])
    m.RecordListTrash.mockResolvedValue([])
    m.RecordGet.mockResolvedValue(undefined)
    m.RecordCreate.mockResolvedValue(undefined)
    m.RecordUpdate.mockResolvedValue(undefined)
    m.RecordDelete.mockResolvedValue(undefined)
    m.RecordRestore.mockResolvedValue(undefined)
    m.RecordPurge.mockResolvedValue(undefined)
    m.ClipboardCopy.mockResolvedValue(undefined)
    m.PasswordGenerate.mockResolvedValue('generated-password')
    m.VaultChangeMasterPassword.mockResolvedValue(undefined)

    mockVaultExists.mockImplementation(() => m.VaultExists())
    mockRecordListTrash.mockImplementation(() => m.RecordListTrash())

    ;(window as unknown as Record<string, unknown>).go = {
      backend: {
        App: {
          VaultExists: () => mockVaultExists(),
          RecordListTrash: () => mockRecordListTrash(),
        },
      },
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('app renders the lock screen in "Unlock vault" mode when VaultExists returns true and vault is locked', async () => {
    m.VaultIsUnlocked.mockResolvedValue(false)
    m.VaultExists.mockResolvedValue(true)

    render(<App />)

    // LockView detects returning user asynchronously
    expect(await screen.findByText('Unlock your vault')).toBeInTheDocument()
    // Only one password field (no confirm field in unlock mode)
    const passwordInputs = document.querySelectorAll('input[type="password"]')
    expect(passwordInputs).toHaveLength(1)
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
    expect(screen.queryByText('Confirm password')).not.toBeInTheDocument()
  })

  it('entering the wrong password shows the backend error message; user remains on lock screen', async () => {
    m.VaultIsUnlocked.mockResolvedValue(false)
    m.VaultExists.mockResolvedValue(true)
    m.VaultUnlock.mockRejectedValue(new Error('wrong password'))

    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Unlock your vault')

    const passwordInput = document.querySelector('input[type="password"]') as HTMLElement
    await user.type(passwordInput, 'badpassword')
    await user.click(screen.getByRole('button', { name: /unlock/i }))

    expect(await screen.findByText('wrong password')).toBeInTheDocument()
    // Still on lock screen
    expect(screen.getByText('Unlock your vault')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument()
  })

  it('entering the correct password calls VaultUnlock and transitions to the list view', async () => {
    m.VaultIsUnlocked.mockResolvedValue(false)
    m.VaultExists.mockResolvedValue(true)
    m.VaultUnlock.mockResolvedValue(undefined)
    m.RecordList.mockResolvedValue([])

    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Unlock your vault')

    const passwordInput = document.querySelector('input[type="password"]') as HTMLElement
    await user.type(passwordInput, 'correctpassword')
    await user.click(screen.getByRole('button', { name: /unlock/i }))

    expect(m.VaultUnlock).toHaveBeenCalledWith('correctpassword')

    // Should transition to list view
    await screen.findByPlaceholderText('Search…')
    expect(screen.queryByText('Unlock your vault')).not.toBeInTheDocument()
  })

  it('clicking the Lock button from the list view calls VaultLock and returns to the lock screen', async () => {
    // Two initial `true` calls: LockView's detect() fires before useVault's check()
    // (React runs child effects before parent effects), so both need to see `true`.
    // Subsequent calls → false so LockView stays locked after VaultLock fires.
    m.VaultIsUnlocked
      .mockResolvedValueOnce(true)  // LockView's detect() on first render
      .mockResolvedValueOnce(true)  // useVault's check() on first render
      .mockResolvedValue(false)     // all calls after VaultLock (LockView re-mounts)
    m.VaultExists.mockResolvedValue(true)
    m.VaultLock.mockResolvedValue(undefined)
    m.RecordList.mockResolvedValue([])

    const user = userEvent.setup()
    render(<App />)

    // Wait for list view to load (VaultIsUnlocked returns true so app bypasses lock screen)
    await screen.findByPlaceholderText('Search…')

    // Click the Lock button in the bottom bar
    await user.click(screen.getByRole('button', { name: /^lock$/i }))

    expect(m.VaultLock).toHaveBeenCalled()

    // After VaultLock resolves, isUnlocked → false → LockView mounts →
    // detect() calls VaultIsUnlocked (→ false) and VaultExists (→ true) → Unlock mode
    await screen.findByText('Unlock your vault')
    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument()
  })

  it('after auto-lock timeout fires (mocked via vi.useFakeTimers), the app returns to the lock screen', async () => {
    vi.useFakeTimers()

    // Two initial `true` calls: LockView's detect() fires before useVault's check()
    // (React runs child effects before parent effects), so both need to see `true`.
    // Subsequent calls → false so LockView stays locked after auto-lock fires.
    m.VaultIsUnlocked
      .mockResolvedValueOnce(true)  // LockView's detect() on first render
      .mockResolvedValueOnce(true)  // useVault's check() on first render
      .mockResolvedValue(false)     // all calls after auto-lock fires
    m.VaultExists.mockResolvedValue(true)
    m.VaultLock.mockResolvedValue(undefined)
    m.RecordList.mockResolvedValue([])

    render(<App />)

    // Flush microtasks: VaultIsUnlocked resolves true → isUnlocked=true → ListView renders
    await act(async () => { await Promise.resolve() })

    // Advance past the debounce so RecordList is called and list settles
    await act(async () => { vi.advanceTimersByTime(200) })
    await act(async () => { await Promise.resolve() })

    // Confirm we are on the list view
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()

    // Advance past the 5-minute auto-lock timeout
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000 + 100) })

    // Flush microtasks for VaultLock().then(() => setIsUnlocked(false)) to settle
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })

    expect(m.VaultLock).toHaveBeenCalled()

    // LockView should now be visible (VaultIsUnlocked → false, VaultExists → true → unlock mode)
    await waitFor(() => {
      expect(screen.getByText('Unlock your vault')).toBeInTheDocument()
    }, { timeout: 3000 })
    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument()
  })
})
