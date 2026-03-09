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
  id: 'rec-1',
  type: 'password',
  name: 'GitHub',
  username_masked: 'us***om',
  created_at: 0,
  updated_at: 0,
}

const detail = {
  id: 'rec-1',
  type: 'password',
  name: 'GitHub',
  username: 'user@example.com',
  username_masked: 'us***om',
  password: 'secret123',
  url: '',
  notes: '',
  tags: [],
  created_at: 0,
  updated_at: 0,
}

describe('Journey: View Detail', () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset())

    m.VaultIsUnlocked.mockResolvedValue(true)
    m.VaultCreate.mockResolvedValue(undefined)
    m.VaultUnlock.mockResolvedValue(undefined)
    m.VaultLock.mockResolvedValue(undefined)
    m.VaultExists.mockResolvedValue(true)
    m.RecordList.mockResolvedValue([summary])
    m.RecordGet.mockResolvedValue(detail)
    m.RecordCreate.mockResolvedValue(undefined)
    m.RecordUpdate.mockResolvedValue(undefined)
    m.RecordDelete.mockResolvedValue(undefined)
    m.RecordRestore.mockResolvedValue(undefined)
    m.RecordPurge.mockResolvedValue(undefined)
    m.RecordListTrash.mockResolvedValue([])
    m.ClipboardCopy.mockResolvedValue(undefined)
    m.PasswordGenerate.mockResolvedValue('generated-password')
    m.VaultChangeMasterPassword.mockResolvedValue(undefined)

    ;(window as unknown as Record<string, unknown>).go = {
      backend: {
        App: {
          VaultExists: () => m.VaultExists(),
          RecordListTrash: () => m.RecordListTrash(),
        },
      },
    }
  })

/** Helper: render the app and wait for the list to load with the GitHub card. */
  async function renderUnlockedWithList() {
    render(<App />)
    // The list view appears after VaultIsUnlocked resolves true
    await screen.findByPlaceholderText('Search…')
    // Wait for the debounced RecordList call to complete and the card to appear
    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument()
    }, { timeout: 1000 })
  }

  /** Helper: navigate from the list into the detail view. */
  async function navigateToDetail() {
    await renderUnlockedWithList()
    const user = userEvent.setup()
    // Click the main card button (which wraps the record name)
    const githubButton = screen.getByRole('button', { name: /GitHub/i })
    await user.click(githubButton)
    // Wait for the detail view to load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /← Back/i })).toBeInTheDocument()
    })
    return user
  }

  it('clicking a record card in the list navigates to the detail view showing the record name', async () => {
    await navigateToDetail()

    // The header shows the record name
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    // The detail view loaded correctly (back button present)
    expect(screen.getByRole('button', { name: /← Back/i })).toBeInTheDocument()
  })

  it('the password field shows •••••••• by default on the detail view', async () => {
    await navigateToDetail()

    // The password span should show the bullet mask, not the plaintext
    const passwordMask = screen.getByText('••••••••')
    expect(passwordMask).toBeInTheDocument()
    expect(screen.queryByText('secret123')).not.toBeInTheDocument()
  })

  it('clicking "Reveal" shows the plaintext password; clicking "Hide" masks it again', async () => {
    const user = await navigateToDetail()

    // Initially masked
    expect(screen.getByText('••••••••')).toBeInTheDocument()
    expect(screen.queryByText('secret123')).not.toBeInTheDocument()

    // Click Reveal
    await user.click(screen.getByRole('button', { name: /^Reveal$/i }))

    // Password is now visible
    expect(screen.queryByText('••••••••')).not.toBeInTheDocument()
    expect(screen.getByText('secret123')).toBeInTheDocument()

    // The button text changed to Hide
    expect(screen.getByRole('button', { name: /^Hide$/i })).toBeInTheDocument()

    // Click Hide to mask again
    await user.click(screen.getByRole('button', { name: /^Hide$/i }))

    // Masked again
    expect(screen.getByText('••••••••')).toBeInTheDocument()
    expect(screen.queryByText('secret123')).not.toBeInTheDocument()
  })

  it('username is shown masked by default; clicking "Show" reveals full username; "Hide" re-masks it', async () => {
    const user = await navigateToDetail()

    // Masked by default
    expect(screen.getByText('us***om')).toBeInTheDocument()
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument()

    // Click Show (on the username field — there are two Show/Hide buttons; find the one in the username row)
    // The username field Show button comes before the password Reveal button in the DOM
    const showButtons = screen.getAllByRole('button', { name: /^Show$/i })
    await user.click(showButtons[0])

    // Full username visible
    expect(screen.getByText('user@example.com')).toBeInTheDocument()

    // The Show button for username should now say Hide
    const hideButtons = screen.getAllByRole('button', { name: /^Hide$/i })
    expect(hideButtons.length).toBeGreaterThanOrEqual(1)

    // Click Hide to re-mask
    await user.click(hideButtons[0])

    expect(screen.getByText('us***om')).toBeInTheDocument()
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument()
  })

  it('clicking "Copy" on the password field calls ClipboardCopy with the password value and shows "Copied!" label', async () => {
    const user = await navigateToDetail()

    // There are two Copy buttons (username and password); the password Copy button
    // is associated with the secret/password field — it's the second one in the DOM
    const copyButtons = screen.getAllByRole('button', { name: /^Copy$/i })
    // password Copy is the second Copy button (after username Copy)
    const passwordCopyButton = copyButtons[1]

    await user.click(passwordCopyButton)

    expect(m.ClipboardCopy).toHaveBeenCalledWith('secret123', 30)
    expect(await screen.findByText('Copied!')).toBeInTheDocument()
  })

  it('"Copied!" label reverts to "Copy" after 2 seconds', async () => {
    const user = await navigateToDetail()

    // Click the password Copy button (second Copy button)
    const copyButtons = screen.getAllByRole('button', { name: /^Copy$/i })
    await user.click(copyButtons[1])

    // "Copied!" should appear
    expect(await screen.findByText('Copied!')).toBeInTheDocument()

    // Wait for the 2-second revert (useClipboard clears after 2000ms)
    await waitFor(() => {
      expect(screen.queryByText('Copied!')).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /^Copy$/i }).length).toBeGreaterThanOrEqual(2)
    }, { timeout: 3000 })
  })

  it('clicking "← Back" from the detail view returns to the list view', async () => {
    const user = await navigateToDetail()

    // Confirm we are in detail view
    expect(screen.getByRole('button', { name: /← Back/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /← Back/i }))

    // Back on the list view
    await screen.findByPlaceholderText('Search…')
    expect(screen.queryByRole('button', { name: /← Back/i })).not.toBeInTheDocument()
  })

  it('URL, Notes, and Tags fields render "—" when empty', async () => {
    // detail has url:'', notes:'', tags:[]
    await navigateToDetail()

    // Three empty fields should each show the em dash placeholder
    const emDashes = screen.getAllByText('—')
    // At minimum URL, Notes, and Tags each contribute one em dash
    expect(emDashes.length).toBeGreaterThanOrEqual(3)
  })
})
