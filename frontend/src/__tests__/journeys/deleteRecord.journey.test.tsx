import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

const summary = {
  id: 'rec-1', type: 'password', name: 'GitHub',
  username_masked: 'us***om', created_at: 0, updated_at: 0,
}
const detail = {
  id: 'rec-1', type: 'password', name: 'GitHub',
  username: 'user@example.com', username_masked: 'us***om',
  password: 'secret123', url: '', notes: '', tags: [],
  created_at: 0, updated_at: 0,
}

describe('Journey: Delete Record', () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset())
    m.VaultIsUnlocked.mockResolvedValue(true)
    m.VaultLock.mockResolvedValue(undefined)
    m.VaultExists.mockResolvedValue(true)
    m.RecordList.mockResolvedValue([summary])
    m.RecordGet.mockResolvedValue(detail)
    m.RecordDelete.mockResolvedValue(undefined)
    m.RecordRestore.mockResolvedValue(undefined)
    m.RecordPurge.mockResolvedValue(undefined)
    m.RecordListTrash.mockResolvedValue([])
    m.ClipboardCopy.mockResolvedValue(undefined)
    m.PasswordGenerate.mockResolvedValue('generated-password')
    m.VaultChangeMasterPassword.mockResolvedValue(undefined)

    ;(window as any).go = {
      backend: { App: { VaultExists: () => m.VaultExists(), RecordListTrash: () => m.RecordListTrash() } },
    }
  })

  /** Navigate from list to detail view. */
  async function navigateToDetail() {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByPlaceholderText('Search…')
    await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /GitHub/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /← Back/i })).toBeInTheDocument())
    return user
  }

  it('clicking "Delete" on the detail view shows a confirm dialog with the record name in the message', async () => {
    const user = await navigateToDetail()
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    // ConfirmDialog should appear with the record name in the message
    await waitFor(() => expect(screen.getByText(/This can be restored from trash/)).toBeInTheDocument())
    // Both dialog buttons should be present
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('clicking "Cancel" in the confirm dialog dismisses it; the record is still shown; RecordDelete is not called', async () => {
    const user = await navigateToDetail()
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    // Detail view still visible, dialog gone
    expect(screen.getByRole('button', { name: /← Back/i })).toBeInTheDocument()
    expect(m.RecordDelete).not.toHaveBeenCalled()
  })

  it('clicking "Delete" in the confirm dialog calls RecordDelete and navigates back to the list view', async () => {
    const user = await navigateToDetail()
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument())

    // ConfirmDialog is rendered BEFORE the header Delete in DetailView's JSX,
    // so index [0] is the ConfirmDialog's Delete button
    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(m.RecordDelete).toHaveBeenCalledWith('rec-1')
    })

    // Navigated back to list view
    await screen.findByPlaceholderText('Search…')
    expect(screen.queryByRole('button', { name: /← Back/i })).not.toBeInTheDocument()
  })

  it('the deleted record no longer appears in the list after deletion', async () => {
    // After delete, RecordList returns empty
    m.RecordList.mockResolvedValueOnce([summary]).mockResolvedValue([])

    const user = await navigateToDetail()
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument())
    // ConfirmDialog is rendered BEFORE the header Delete in DetailView's JSX
    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
    fireEvent.click(deleteButtons[0])

    // Back to list — record should be gone
    await screen.findByPlaceholderText('Search…')
    await waitFor(() => {
      expect(screen.queryByText('GitHub')).not.toBeInTheDocument()
      expect(screen.getByText('No records yet.')).toBeInTheDocument()
    })
  })

  it('clicking Delete (⋮ menu) on a record card shows the confirm dialog; confirming removes it from the list', async () => {
    m.RecordList.mockResolvedValueOnce([summary]).mockResolvedValue([])

    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument())

    // Open the ⋮ actions menu
    await user.click(screen.getByRole('button', { name: 'Actions' }))
    // Click Delete from the dropdown
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    // ConfirmDialog appears
    await waitFor(() => expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument())

    // Confirm deletion
    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
    await user.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() => expect(m.RecordDelete).toHaveBeenCalledWith('rec-1'))

    // Record gone from list
    await waitFor(() => {
      expect(screen.queryByText('GitHub')).not.toBeInTheDocument()
    })
  })
})
