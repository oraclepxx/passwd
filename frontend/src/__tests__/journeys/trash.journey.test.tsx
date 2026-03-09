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

const activeRecord = {
  id: 'rec-1', type: 'password', name: 'GitHub',
  username_masked: 'us***om', created_at: 0, updated_at: 0,
}
const trashRecord = {
  id: 'trash-1', type: 'password', name: 'OldSite',
  username_masked: 'ol***om', created_at: 0, updated_at: 0,
}

describe('Journey: Trash — Restore & Purge', () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset())
    m.VaultIsUnlocked.mockResolvedValue(true)
    m.VaultLock.mockResolvedValue(undefined)
    m.VaultExists.mockResolvedValue(true)
    m.RecordList.mockResolvedValue([activeRecord])
    m.RecordGet.mockResolvedValue(null)
    m.RecordDelete.mockResolvedValue(undefined)
    m.RecordRestore.mockResolvedValue(undefined)
    m.RecordPurge.mockResolvedValue(undefined)
    m.RecordListTrash.mockResolvedValue([trashRecord])
    m.ClipboardCopy.mockResolvedValue(undefined)
    m.PasswordGenerate.mockResolvedValue('generated-password')
    m.VaultChangeMasterPassword.mockResolvedValue(undefined)

    ;(window as any).go = {
      backend: { App: { VaultExists: () => m.VaultExists(), RecordListTrash: () => m.RecordListTrash() } },
    }
  })

  /** Render the app and navigate to the trash view. */
  async function navigateToTrash() {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByPlaceholderText('Search…')
    // Wait for the initial debounced RecordList call to consume the first mock value
    await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument(), { timeout: 2000 })
    await user.click(screen.getByRole('button', { name: /^trash$/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trash' })).toBeInTheDocument())
    return user
  }

  it('clicking "Trash" from the list view navigates to the trash view', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByPlaceholderText('Search…')

    await user.click(screen.getByRole('button', { name: /^trash$/i }))

    await waitFor(() => expect(screen.getByText('Trash')).toBeInTheDocument())
    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument()
  })

  it('the trash view shows deleted records; active records are not listed', async () => {
    await navigateToTrash()

    await waitFor(() => expect(screen.getByText('OldSite')).toBeInTheDocument())
    // Active records should not appear in trash view
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument()
  })

  it('clicking "Restore" on a trash item calls RecordRestore and removes the item from the trash list', async () => {
    // After restore, trash list is empty
    m.RecordListTrash
      .mockResolvedValueOnce([trashRecord])
      .mockResolvedValue([])

    const user = await navigateToTrash()
    await waitFor(() => expect(screen.getByText('OldSite')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /restore/i }))

    await waitFor(() => {
      expect(m.RecordRestore).toHaveBeenCalledWith('trash-1')
    })
    // Trash list refreshed — item is gone
    await waitFor(() => expect(screen.queryByText('OldSite')).not.toBeInTheDocument())
    expect(screen.getByText('Trash is empty.')).toBeInTheDocument()
  })

  it('clicking "Delete" on a trash item shows a confirm dialog with "cannot be undone" warning', async () => {
    const user = await navigateToTrash()
    await waitFor(() => expect(screen.getByText('OldSite')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('cancelling the purge confirm dialog keeps the item in the trash list', async () => {
    const user = await navigateToTrash()
    await waitFor(() => expect(screen.getByText('OldSite')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    // Item still in list, no purge call made
    expect(screen.getByText('OldSite')).toBeInTheDocument()
    expect(m.RecordPurge).not.toHaveBeenCalled()
  })

  it('confirming the purge dialog calls RecordPurge and removes the item from the trash list', async () => {
    m.RecordListTrash
      .mockResolvedValueOnce([trashRecord])
      .mockResolvedValue([])

    const user = await navigateToTrash()
    await waitFor(() => expect(screen.getByText('OldSite')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument())

    // Confirm purge (the Delete button inside the dialog)
    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
    await user.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() => expect(m.RecordPurge).toHaveBeenCalledWith('trash-1'))
    await waitFor(() => expect(screen.queryByText('OldSite')).not.toBeInTheDocument())
  })

  it('clicking "← Back" from the trash view returns to the list view', async () => {
    const user = await navigateToTrash()

    await user.click(screen.getByRole('button', { name: /← Back/i }))

    await screen.findByPlaceholderText('Search…')
    // Check the Trash heading is gone (ListView still has a "Trash" button, so check heading)
    expect(screen.queryByRole('heading', { name: 'Trash' })).not.toBeInTheDocument()
  })

  it('after restoring a record, it reappears in the main list view', async () => {
    const restoredRecord = { ...trashRecord, id: 'trash-1', name: 'OldSite' }
    m.RecordListTrash
      .mockResolvedValueOnce([trashRecord])
      .mockResolvedValue([])
    // After restore, main list includes the restored record
    m.RecordList
      .mockResolvedValueOnce([activeRecord])
      .mockResolvedValue([activeRecord, restoredRecord])

    const user = await navigateToTrash()
    await waitFor(() => expect(screen.getByText('OldSite')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /restore/i }))
    await waitFor(() => expect(m.RecordRestore).toHaveBeenCalledWith('trash-1'))

    // Navigate back to list
    await user.click(screen.getByRole('button', { name: /← Back/i }))
    await screen.findByPlaceholderText('Search…')

    // Restored record now appears in the list
    await waitFor(() => expect(screen.getByText('OldSite')).toBeInTheDocument())
  })
})
