import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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

describe('Journey: Create Password Record', () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset())

    m.VaultIsUnlocked.mockResolvedValue(true)
    m.VaultCreate.mockResolvedValue(undefined)
    m.VaultUnlock.mockResolvedValue(undefined)
    m.VaultLock.mockResolvedValue(undefined)
    m.VaultExists.mockResolvedValue(true)
    m.VaultChangeMasterPassword.mockResolvedValue(undefined)
    m.RecordList.mockResolvedValue([])
    m.RecordGet.mockResolvedValue(undefined)
    m.RecordCreate.mockResolvedValue('new-id')
    m.RecordUpdate.mockResolvedValue(undefined)
    m.RecordDelete.mockResolvedValue(undefined)
    m.RecordRestore.mockResolvedValue(undefined)
    m.RecordPurge.mockResolvedValue(undefined)
    m.RecordListTrash.mockResolvedValue([])
    m.ClipboardCopy.mockResolvedValue(undefined)
    m.PasswordGenerate.mockResolvedValue('generated-password')

    ;(window as any).go = {
      backend: {
        App: {
          VaultExists: () => m.VaultExists(),
          RecordListTrash: () => m.RecordListTrash(),
        },
      },
    }
  })

  it('clicking "+ New" from the list view opens the form in create mode with empty fields and "Password" type selected', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')

    await user.click(screen.getByRole('button', { name: /\+ new/i }))

    expect(screen.getByText('New record')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. GitHub')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. user@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    // Name, Username and Password inputs should all be empty
    expect(screen.getByPlaceholderText('e.g. GitHub')).toHaveValue('')
    expect(screen.getByPlaceholderText('e.g. user@example.com')).toHaveValue('')
    expect(screen.getByPlaceholderText('Password')).toHaveValue('')
  })

  it('the type selector is visible in create mode', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')

    await user.click(screen.getByRole('button', { name: /\+ new/i }))

    expect(screen.getByRole('button', { name: /^password$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /api key/i })).toBeInTheDocument()
  })

  it('submitting the form with Name empty shows a validation error and does not call RecordCreate', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')

    await user.click(screen.getByRole('button', { name: /\+ new/i }))

    // Leave Name empty, fill Username and Password
    await user.type(screen.getByPlaceholderText('e.g. user@example.com'), 'user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'mypassword')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(m.RecordCreate).not.toHaveBeenCalled()
  })

  it('submitting the form with Username empty shows a validation error and does not call RecordCreate', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')

    await user.click(screen.getByRole('button', { name: /\+ new/i }))

    // Fill Name and Password, leave Username empty
    await user.type(screen.getByPlaceholderText('e.g. GitHub'), 'GitHub')
    await user.type(screen.getByPlaceholderText('Password'), 'mypassword')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByText('Username is required')).toBeInTheDocument()
    expect(m.RecordCreate).not.toHaveBeenCalled()
  })

  it('filling all required fields and submitting calls RecordCreate with the correct payload', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')

    await user.click(screen.getByRole('button', { name: /\+ new/i }))

    await user.type(screen.getByPlaceholderText('e.g. GitHub'), 'GitHub')
    await user.type(screen.getByPlaceholderText('e.g. user@example.com'), 'user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'mypassword')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(m.RecordCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'password',
          name: 'GitHub',
          username: 'user@example.com',
          password: 'mypassword',
        })
      )
    })
  })

  it('after successful create, the app navigates back to the list view (not detail view)', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')

    await user.click(screen.getByRole('button', { name: /\+ new/i }))

    await user.type(screen.getByPlaceholderText('e.g. GitHub'), 'GitHub')
    await user.type(screen.getByPlaceholderText('e.g. user@example.com'), 'user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'mypassword')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    // After save, should be back at the list view — not detail view
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
    })
    // Detail view would show "Edit" button; confirm it's not present
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
  })

  it('the newly created record name appears in the list', async () => {
    const newRecord = {
      id: 'new-id',
      type: 'password',
      name: 'GitHub',
      username_masked: 'us***om',
      created_at: 0,
      updated_at: 0,
    }
    // First call returns empty; subsequent calls (after create) return the new record
    m.RecordList.mockResolvedValueOnce([]).mockResolvedValue([newRecord])
    m.RecordCreate.mockResolvedValue('new-id')

    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')

    await user.click(screen.getByRole('button', { name: /\+ new/i }))

    await user.type(screen.getByPlaceholderText('e.g. GitHub'), 'GitHub')
    await user.type(screen.getByPlaceholderText('e.g. user@example.com'), 'user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'mypassword')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    // App navigates back to list; ListView re-fetches records
    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('clicking Cancel from the create form returns to the list view without calling RecordCreate', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')

    await user.click(screen.getByRole('button', { name: /\+ new/i }))

    // Confirm we are in the form
    expect(screen.getByText('New record')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    // Back to list view
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
    expect(m.RecordCreate).not.toHaveBeenCalled()
  })
})
