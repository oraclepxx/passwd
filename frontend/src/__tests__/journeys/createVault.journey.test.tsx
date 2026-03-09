import { render, screen, waitFor } from '@testing-library/react'
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

describe('Journey: Create Vault', () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset())

    // Default behaviors
    m.VaultIsUnlocked.mockResolvedValue(false)
    m.VaultCreate.mockResolvedValue(undefined)
    m.VaultUnlock.mockResolvedValue(undefined)
    m.VaultLock.mockResolvedValue(undefined)
    m.VaultExists.mockResolvedValue(false)
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
    vi.restoreAllMocks()
  })

  it('app renders the lock screen in "Create vault" mode when VaultExists returns false', async () => {
    // VaultIsUnlocked → false, VaultExists → false (first launch)
    m.VaultIsUnlocked.mockResolvedValue(false)
    m.VaultExists.mockResolvedValue(false)

    render(<App />)

    // The lock screen detects first launch asynchronously
    expect(await screen.findByText('Create your vault')).toBeInTheDocument()
    expect(screen.getByText('Master password')).toBeInTheDocument()
    expect(screen.getByText('Confirm password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create vault/i })).toBeInTheDocument()
  })

  it('submitting a password shorter than 8 characters shows an inline error; VaultCreate is not called', async () => {
    m.VaultIsUnlocked.mockResolvedValue(false)
    m.VaultExists.mockResolvedValue(false)

    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Create your vault')

    // Type a short password
    const passwordInputs = screen.getAllByDisplayValue('')
    // The first password-type input is Master password
    const masterPasswordInput = screen.getAllByText('Master password')[0]
      ? document.querySelector('input[type="password"]') as HTMLInputElement
      : passwordInputs[0] as HTMLInputElement

    await user.type(masterPasswordInput, 'short')
    // Confirm field - get the second password input
    const allPasswordInputs = document.querySelectorAll('input[type="password"]')
    await user.type(allPasswordInputs[1] as HTMLElement, 'short')

    await user.click(screen.getByRole('button', { name: /create vault/i }))

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument()
    expect(m.VaultCreate).not.toHaveBeenCalled()
  })

  it('submitting mismatched passwords shows "Passwords do not match" error; VaultCreate is not called', async () => {
    m.VaultIsUnlocked.mockResolvedValue(false)
    m.VaultExists.mockResolvedValue(false)

    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Create your vault')

    const allPasswordInputs = document.querySelectorAll('input[type="password"]')
    await user.type(allPasswordInputs[0] as HTMLElement, 'password123')
    await user.type(allPasswordInputs[1] as HTMLElement, 'different123')

    await user.click(screen.getByRole('button', { name: /create vault/i }))

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(m.VaultCreate).not.toHaveBeenCalled()
  })

  it('submitting valid matching passwords calls VaultCreate and transitions to the list view', async () => {
    m.VaultIsUnlocked.mockResolvedValue(false)
    m.VaultExists.mockResolvedValue(false)
    m.VaultCreate.mockResolvedValue(undefined)
    m.RecordList.mockResolvedValue([])

    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Create your vault')

    const allPasswordInputs = document.querySelectorAll('input[type="password"]')
    await user.type(allPasswordInputs[0] as HTMLElement, 'strongpassword1')
    await user.type(allPasswordInputs[1] as HTMLElement, 'strongpassword1')

    await user.click(screen.getByRole('button', { name: /create vault/i }))

    expect(m.VaultCreate).toHaveBeenCalledWith('strongpassword1')

    // After VaultCreate resolves the app transitions to list view
    await screen.findByPlaceholderText('Search…')
  })

  it('the list view shows "No records yet." after a fresh vault creation', async () => {
    m.VaultIsUnlocked.mockResolvedValue(false)
    m.VaultExists.mockResolvedValue(false)
    m.VaultCreate.mockResolvedValue(undefined)
    m.RecordList.mockResolvedValue([])

    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Create your vault')

    const allPasswordInputs = document.querySelectorAll('input[type="password"]')
    await user.type(allPasswordInputs[0] as HTMLElement, 'strongpassword1')
    await user.type(allPasswordInputs[1] as HTMLElement, 'strongpassword1')

    await user.click(screen.getByRole('button', { name: /create vault/i }))

    // Wait for list view to appear
    await screen.findByPlaceholderText('Search…')

    // The list is empty so "No records yet." should appear after debounce
    await waitFor(() => {
      expect(screen.getByText('No records yet.')).toBeInTheDocument()
    }, { timeout: 1000 })
  })
})
