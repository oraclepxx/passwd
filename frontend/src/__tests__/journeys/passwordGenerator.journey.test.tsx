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

describe('Journey: Password Generator in Form', () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset())
    m.VaultIsUnlocked.mockResolvedValue(true)
    m.VaultLock.mockResolvedValue(undefined)
    m.VaultExists.mockResolvedValue(true)
    m.RecordList.mockResolvedValue([])
    m.RecordCreate.mockResolvedValue('new-id')
    m.RecordListTrash.mockResolvedValue([])
    m.ClipboardCopy.mockResolvedValue(undefined)
    m.PasswordGenerate.mockResolvedValue('generated-abc-123')
    m.VaultChangeMasterPassword.mockResolvedValue(undefined)

    ;(window as any).go = {
      backend: { App: { VaultExists: () => m.VaultExists(), RecordListTrash: () => m.RecordListTrash() } },
    }
  })

  /** Render app, navigate to the create form. */
  async function navigateToCreateForm() {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByPlaceholderText('Search…')
    await screen.findByText('No records yet.')
    await user.click(screen.getByRole('button', { name: /\+ new/i }))
    await waitFor(() => expect(screen.getByText('New record')).toBeInTheDocument())
    return user
  }

  it('clicking "Generate" in the create form opens the generator options panel (length slider, char-class toggles)', async () => {
    const user = await navigateToCreateForm()

    await user.click(screen.getByRole('button', { name: /^generate$/i }))

    // Options panel should appear
    expect(screen.getByRole('button', { name: /generate password/i })).toBeInTheDocument()
    // Length slider
    expect(screen.getByRole('slider')).toBeInTheDocument()
    // Character class checkboxes: A–Z, 0–9, !@#
    expect(screen.getByLabelText('A–Z')).toBeInTheDocument()
    expect(screen.getByLabelText('0–9')).toBeInTheDocument()
    expect(screen.getByLabelText('!@#')).toBeInTheDocument()
  })

  it('clicking "Generate password" in the options panel calls PasswordGenerate and fills the password field', async () => {
    const user = await navigateToCreateForm()

    await user.click(screen.getByRole('button', { name: /^generate$/i }))
    await user.click(screen.getByRole('button', { name: /generate password/i }))

    await waitFor(() => {
      expect(m.PasswordGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ length: 20, use_symbols: true, use_numbers: true, use_uppercase: true })
      )
    })

    // Field should be filled
    expect(screen.getByPlaceholderText('Password')).toHaveValue('generated-abc-123')
  })

  it('the generated password is visible in the password input (not masked) after generation', async () => {
    const user = await navigateToCreateForm()

    await user.click(screen.getByRole('button', { name: /^generate$/i }))
    await user.click(screen.getByRole('button', { name: /generate password/i }))

    await waitFor(() => expect(m.PasswordGenerate).toHaveBeenCalled())

    // PasswordField sets show=true after generation, so type becomes "text"
    const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement
    expect(passwordInput.type).toBe('text')
    expect(passwordInput.value).toBe('generated-abc-123')
  })

  it('disabling Symbols toggle and generating calls PasswordGenerate with use_symbols: false', async () => {
    const user = await navigateToCreateForm()

    await user.click(screen.getByRole('button', { name: /^generate$/i }))

    // Uncheck the Symbols (!@#) checkbox
    const symbolsCheckbox = screen.getByLabelText('!@#')
    expect(symbolsCheckbox).toBeChecked()
    await user.click(symbolsCheckbox)
    expect(symbolsCheckbox).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: /generate password/i }))

    await waitFor(() => {
      expect(m.PasswordGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ use_symbols: false })
      )
    })
  })

  it('adjusting the length slider and generating calls PasswordGenerate with the selected length', async () => {
    const user = await navigateToCreateForm()

    await user.click(screen.getByRole('button', { name: /^generate$/i }))

    // Change the length slider value to 32
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '32' } })

    await user.click(screen.getByRole('button', { name: /generate password/i }))

    await waitFor(() => {
      expect(m.PasswordGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ length: 32 })
      )
    })
  })

  it('generated password is submitted as part of the record when the form is saved', async () => {
    const user = await navigateToCreateForm()

    // Fill required fields
    await user.type(screen.getByPlaceholderText('e.g. GitHub'), 'MyApp')
    await user.type(screen.getByPlaceholderText('e.g. user@example.com'), 'user@example.com')

    // Generate password
    await user.click(screen.getByRole('button', { name: /^generate$/i }))
    await user.click(screen.getByRole('button', { name: /generate password/i }))
    await waitFor(() => expect(m.PasswordGenerate).toHaveBeenCalled())

    // Save the form
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(m.RecordCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'password',
          name: 'MyApp',
          username: 'user@example.com',
          password: 'generated-abc-123',
        })
      )
    })
  })
})
