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

const record1 = {
  id: 'rec-1', type: 'password', name: 'GitHub',
  username_masked: 'us***om', created_at: 0, updated_at: 0,
}
const record2 = {
  id: 'rec-2', type: 'password', name: 'Google',
  username_masked: 'go***le', created_at: 0, updated_at: 0,
}

describe('Journey: Search Records', () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset())
    m.VaultIsUnlocked.mockResolvedValue(true)
    m.VaultLock.mockResolvedValue(undefined)
    m.VaultExists.mockResolvedValue(true)
    m.RecordList.mockResolvedValue([record1, record2])
    m.RecordListTrash.mockResolvedValue([])
    m.ClipboardCopy.mockResolvedValue(undefined)
    m.PasswordGenerate.mockResolvedValue('generated-password')
    m.VaultChangeMasterPassword.mockResolvedValue(undefined)

    ;(window as any).go = {
      backend: { App: { VaultExists: () => m.VaultExists(), RecordListTrash: () => m.RecordListTrash() } },
    }
  })

  /** Render app and wait for the initial record list to load. */
  async function renderAndLoad() {
    render(<App />)
    await screen.findByPlaceholderText('Search…')
    // Wait for the debounced RecordList call to complete and records to appear
    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument()
    }, { timeout: 2000 })
  }

  it('list view shows all records on load (empty query)', async () => {
    await renderAndLoad()

    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()
  })

  it('typing in the search box debounces 150 ms then calls RecordList with the typed query', async () => {
    await renderAndLoad()

    const searchInput = screen.getByPlaceholderText('Search…')
    const user = userEvent.setup()

    m.RecordList.mockResolvedValue([record1])
    await user.type(searchInput, 'git')

    // Wait for debounce to fire and RecordList to be called with 'git'
    await waitFor(() => {
      expect(m.RecordList).toHaveBeenCalledWith('git')
    }, { timeout: 2000 })
  })

  it('only records matching the query are rendered; non-matching records are absent', async () => {
    await renderAndLoad()

    m.RecordList.mockResolvedValue([record1])
    const searchInput = screen.getByPlaceholderText('Search…')
    const user = userEvent.setup()

    await user.type(searchInput, 'git')

    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument()
      expect(screen.queryByText('Google')).not.toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('clearing the search input restores the full record list', async () => {
    await renderAndLoad()

    const searchInput = screen.getByPlaceholderText('Search…')
    const user = userEvent.setup()

    // Type a query
    m.RecordList.mockResolvedValue([record1])
    await user.type(searchInput, 'git')
    await waitFor(() => expect(screen.queryByText('Google')).not.toBeInTheDocument(), { timeout: 2000 })

    // Clear the input
    m.RecordList.mockResolvedValue([record1, record2])
    await user.clear(searchInput)

    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument()
      expect(screen.getByText('Google')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('when no records match the query, "No records match your search." is shown', async () => {
    await renderAndLoad()

    m.RecordList.mockResolvedValue([])
    const searchInput = screen.getByPlaceholderText('Search…')
    const user = userEvent.setup()

    await user.type(searchInput, 'zzz')

    await waitFor(() => {
      expect(screen.getByText('No records match your search.')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('search works by record name (case-insensitive match via backend)', async () => {
    await renderAndLoad()

    m.RecordList.mockResolvedValue([record1])
    const searchInput = screen.getByPlaceholderText('Search…')
    const user = userEvent.setup()

    await user.type(searchInput, 'GitHub')

    await waitFor(() => {
      expect(m.RecordList).toHaveBeenCalledWith('GitHub')
    }, { timeout: 2000 })
    await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument())
  })

  it('search works by username for password-type records', async () => {
    await renderAndLoad()

    m.RecordList.mockResolvedValue([record1])
    const searchInput = screen.getByPlaceholderText('Search…')
    const user = userEvent.setup()

    await user.type(searchInput, 'us***om')

    // RecordList is called with the username query; backend handles the filtering
    await waitFor(() => {
      expect(m.RecordList).toHaveBeenCalledWith('us***om')
    }, { timeout: 2000 })
  })
})
