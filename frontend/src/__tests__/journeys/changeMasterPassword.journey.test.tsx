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

describe('Journey: Change Master Password', () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset())
    m.VaultIsUnlocked.mockResolvedValue(true)
    m.VaultLock.mockResolvedValue(undefined)
    m.VaultExists.mockResolvedValue(true)
    m.RecordList.mockResolvedValue([])
    m.RecordListTrash.mockResolvedValue([])
    m.ClipboardCopy.mockResolvedValue(undefined)
    m.PasswordGenerate.mockResolvedValue('generated-password')
    m.VaultChangeMasterPassword.mockResolvedValue(undefined)

    ;(window as any).go = {
      backend: { App: { VaultExists: () => m.VaultExists(), RecordListTrash: () => m.RecordListTrash() } },
    }
  })

  /** Navigate from list view to the Change Password view. */
  async function navigateToChangePassword() {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByPlaceholderText('Search…')
    await user.click(screen.getByRole('button', { name: /settings/i }))
    await waitFor(() => expect(screen.getByText('Change master password')).toBeInTheDocument())
    return user
  }

  /** Helper: fill the change-password form fields. */
  async function fillForm(user: ReturnType<typeof userEvent.setup>, current: string, next: string, confirm: string) {
    const inputs = document.querySelectorAll('input[type="password"]')
    if (inputs[0]) await user.type(inputs[0] as HTMLElement, current)
    if (inputs[1]) await user.type(inputs[1] as HTMLElement, next)
    if (inputs[2]) await user.type(inputs[2] as HTMLElement, confirm)
  }

  it('clicking "Settings" from the list view navigates to the Change Password view', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByPlaceholderText('Search…')

    await user.click(screen.getByRole('button', { name: /settings/i }))

    await waitFor(() => expect(screen.getByText('Change master password')).toBeInTheDocument())
    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument()
  })

  it('submitting with the wrong current password shows the backend error; vault remains unlocked', async () => {
    m.VaultChangeMasterPassword.mockRejectedValue(new Error('wrong password'))

    const user = await navigateToChangePassword()
    await fillForm(user, 'wrongpassword', 'newpassword123', 'newpassword123')

    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => expect(screen.getByText('Current password is incorrect')).toBeInTheDocument())
    // Still on the change password view (vault still unlocked)
    expect(screen.getByText('Change master password')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument()
  })

  it('submitting with a new password shorter than 8 characters shows a validation error', async () => {
    const user = await navigateToChangePassword()
    await fillForm(user, 'currentpassword', 'short', 'short')

    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() =>
      expect(screen.getByText('New password must be at least 8 characters')).toBeInTheDocument()
    )
    expect(m.VaultChangeMasterPassword).not.toHaveBeenCalled()
  })

  it('submitting with mismatched new passwords shows "Passwords do not match" error', async () => {
    const user = await navigateToChangePassword()
    await fillForm(user, 'currentpassword', 'newpassword123', 'differentpass456')

    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() =>
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    )
    expect(m.VaultChangeMasterPassword).not.toHaveBeenCalled()
  })

  it('submitting valid current + matching new passwords calls VaultChangeMasterPassword and returns to list view', async () => {
    const user = await navigateToChangePassword()
    await fillForm(user, 'currentpassword', 'newpassword123', 'newpassword123')

    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(m.VaultChangeMasterPassword).toHaveBeenCalledWith('currentpassword', 'newpassword123')
    })

    // Success message appears
    await waitFor(() =>
      expect(screen.getByText('Master password updated successfully.')).toBeInTheDocument()
    )

    // Click "Back to list" to return
    await user.click(screen.getByRole('button', { name: /back to list/i }))

    await screen.findByPlaceholderText('Search…')
    expect(screen.queryByText('Change master password')).not.toBeInTheDocument()
  })
})
