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

describe('Journey: Create API Key Record', () => {
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
    m.RecordCreate.mockResolvedValue('api-1')
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

  it('selecting "API Key" type hides the Username field and shows "Key / Token" field', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')

    await user.click(screen.getByRole('button', { name: /\+ new/i }))

    // Default type is Password — Username should be visible
    expect(screen.getByPlaceholderText('e.g. user@example.com')).toBeInTheDocument()

    // Switch to API Key
    await user.click(screen.getByRole('button', { name: /api key/i }))

    // Username field should be gone; Key / Token field should appear
    expect(screen.queryByPlaceholderText('e.g. user@example.com')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Paste your API key or token')).toBeInTheDocument()
    expect(screen.getByText('Key / Token')).toBeInTheDocument()
  })

  it('submitting with Key / Token empty shows a validation error; RecordCreate is not called', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')

    await user.click(screen.getByRole('button', { name: /\+ new/i }))

    // Switch to API Key type
    await user.click(screen.getByRole('button', { name: /api key/i }))

    // Fill Name but leave Key / Token empty
    await user.type(screen.getByPlaceholderText('e.g. OpenAI API Key'), 'OpenAI Key')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByText('Key / Token is required')).toBeInTheDocument()
    expect(m.RecordCreate).not.toHaveBeenCalled()
  })

  it('submitting a valid API key record calls RecordCreate with type: "api_key" and no username', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')

    await user.click(screen.getByRole('button', { name: /\+ new/i }))

    // Switch to API Key type
    await user.click(screen.getByRole('button', { name: /api key/i }))

    await user.type(screen.getByPlaceholderText('e.g. OpenAI API Key'), 'OpenAI Key')
    await user.type(screen.getByPlaceholderText('Paste your API key or token'), 'sk-abc123xyz')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(m.RecordCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'api_key',
          name: 'OpenAI Key',
          secret_key: 'sk-abc123xyz',
        })
      )
    })

    // Confirm no username field was submitted
    const callArg = m.RecordCreate.mock.calls[0][0] as Record<string, unknown>
    expect(callArg).not.toHaveProperty('username')
  })

  it('after save, the record appears in the list with an "API Key" badge and no username shown', async () => {
    const apiRecord = {
      id: 'api-1',
      type: 'api_key',
      name: 'OpenAI Key',
      username_masked: '',
      created_at: 0,
      updated_at: 0,
    }
    // First call returns empty; after create returns the api key record
    m.RecordList.mockResolvedValueOnce([]).mockResolvedValue([apiRecord])
    m.RecordCreate.mockResolvedValue('api-1')

    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')

    await user.click(screen.getByRole('button', { name: /\+ new/i }))

    // Switch to API Key type
    await user.click(screen.getByRole('button', { name: /api key/i }))

    await user.type(screen.getByPlaceholderText('e.g. OpenAI API Key'), 'OpenAI Key')
    await user.type(screen.getByPlaceholderText('Paste your API key or token'), 'sk-abc123xyz')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    // Wait for list view to re-render with the new record
    await waitFor(() => {
      expect(screen.getByText('OpenAI Key')).toBeInTheDocument()
    }, { timeout: 1000 })

    // "API Key" badge should be visible
    expect(screen.getByText('API Key')).toBeInTheDocument()

    // No username row should be shown for api_key records (username_masked is empty)
    // RecordCard only renders the username paragraph when !isApiKey && username_masked is truthy
    expect(screen.queryByText('us***om')).not.toBeInTheDocument()
  })
})
