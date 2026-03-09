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

const summary = {
  id: 'rec-1', type: 'password', name: 'GitHub',
  username_masked: 'us***om', created_at: 0, updated_at: 0,
}
const detail = {
  id: 'rec-1', type: 'password', name: 'GitHub',
  username: 'user@example.com', username_masked: 'us***om',
  password: 'secret123', url: 'https://github.com', notes: 'my notes',
  tags: ['work'], created_at: 0, updated_at: 0,
}

describe('Journey: Edit Record', () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset())
    m.VaultIsUnlocked.mockResolvedValue(true)
    m.VaultLock.mockResolvedValue(undefined)
    m.VaultExists.mockResolvedValue(true)
    m.RecordList.mockResolvedValue([summary])
    m.RecordGet.mockResolvedValue(detail)
    m.RecordUpdate.mockResolvedValue(undefined)
    m.RecordCreate.mockResolvedValue('new-id')
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

  /** Render app, navigate to detail view, return userEvent instance. */
  async function navigateToDetail() {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByPlaceholderText('Search…')
    await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument())
    // The main card button wraps the record name
    await user.click(screen.getByRole('button', { name: /GitHub/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument())
    return user
  }

  it('clicking "Edit" from the detail view navigates to the form pre-filled with the record\'s current values', async () => {
    const user = await navigateToDetail()
    await user.click(screen.getByRole('button', { name: /edit/i }))

    // Form should be in edit mode with pre-filled values
    await waitFor(() => expect(screen.getByDisplayValue('GitHub')).toBeInTheDocument())
    expect(screen.getByDisplayValue('user@example.com')).toBeInTheDocument()
    expect(screen.getByText('Edit record')).toBeInTheDocument()
  })

  it('the type selector is NOT visible in edit mode', async () => {
    const user = await navigateToDetail()
    await user.click(screen.getByRole('button', { name: /edit/i }))

    await waitFor(() => expect(screen.getByText('Edit record')).toBeInTheDocument())
    // Type selector buttons only appear in create mode
    expect(screen.queryByRole('button', { name: /^password$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /api key/i })).not.toBeInTheDocument()
  })

  it('changing the name and saving calls RecordUpdate with the new name; navigates back to detail view', async () => {
    const updatedDetail = { ...detail, name: 'GitHub Updated' }
    m.RecordGet
      .mockResolvedValueOnce(detail)       // first call: DetailView loading
      .mockResolvedValueOnce(detail)       // second call: FormView edit mode pre-fill
      .mockResolvedValue(updatedDetail)    // third call: DetailView reload after save

    const user = await navigateToDetail()
    await user.click(screen.getByRole('button', { name: /edit/i }))

    await waitFor(() => expect(screen.getByDisplayValue('GitHub')).toBeInTheDocument())
    await user.clear(screen.getByDisplayValue('GitHub'))
    await user.type(screen.getByPlaceholderText('e.g. GitHub'), 'GitHub Updated')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(m.RecordUpdate).toHaveBeenCalledWith('rec-1', expect.objectContaining({ name: 'GitHub Updated' }))
    })

    // After save in edit mode, app navigates back to detail view
    await waitFor(() => expect(screen.getByText('GitHub Updated')).toBeInTheDocument())
    expect(screen.queryByText('Edit record')).not.toBeInTheDocument()
  })

  it('changing the password and saving calls RecordUpdate; the updated password is shown on the detail view', async () => {
    const updatedDetail = { ...detail, password: 'newpassword456' }
    m.RecordGet
      .mockResolvedValueOnce(detail)       // DetailView loading
      .mockResolvedValueOnce(detail)       // FormView edit mode pre-fill
      .mockResolvedValue(updatedDetail)    // DetailView reload after save

    const user = await navigateToDetail()
    await user.click(screen.getByRole('button', { name: /edit/i }))

    await waitFor(() => expect(screen.getByDisplayValue('GitHub')).toBeInTheDocument())
    // Clear and retype the password field
    const passwordInput = screen.getByPlaceholderText('Password')
    await user.clear(passwordInput)
    await user.type(passwordInput, 'newpassword456')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(m.RecordUpdate).toHaveBeenCalledWith('rec-1', expect.objectContaining({ password: 'newpassword456' }))
    })

    // After save, detail view reloads; reveal to confirm new password
    await waitFor(() => expect(screen.queryByText('Edit record')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /reveal/i }))
    expect(screen.getByText('newpassword456')).toBeInTheDocument()
  })

  it('clicking Cancel from the edit form returns to the detail view without calling RecordUpdate', async () => {
    const user = await navigateToDetail()
    await user.click(screen.getByRole('button', { name: /edit/i }))

    await waitFor(() => expect(screen.getByText('Edit record')).toBeInTheDocument())

    // Cancel button text is "← Cancel"
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    // Should return to detail view, not list view
    await waitFor(() => expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument())
    expect(screen.queryByText('Edit record')).not.toBeInTheDocument()
    expect(m.RecordUpdate).not.toHaveBeenCalled()
  })

  it('clicking the inline Edit (⋮ menu) on a record card navigates directly to the edit form', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Search…')
    await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument())

    // Open the ⋮ actions menu (aria-label="Actions")
    await user.click(screen.getByRole('button', { name: 'Actions' }))

    // Click Edit from the dropdown
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    // Should navigate directly to the edit form
    await waitFor(() => expect(screen.getByText('Edit record')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByDisplayValue('GitHub')).toBeInTheDocument())
    expect(m.RecordGet).toHaveBeenCalledWith('rec-1')
  })
})
