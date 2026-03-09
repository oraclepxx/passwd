import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRecordCreate = vi.fn()
const mockRecordUpdate = vi.fn()
const mockRecordGet    = vi.fn()
const mockPasswordGenerate = vi.fn()

vi.mock('../../wailsjs/go/backend/App', () => ({
  RecordCreate: (...args: unknown[]) => mockRecordCreate(...args),
  RecordUpdate: (...args: unknown[]) => mockRecordUpdate(...args),
  RecordGet:    (...args: unknown[]) => mockRecordGet(...args),
  RecordList:   vi.fn().mockResolvedValue([]),
  RecordDelete: vi.fn(),
  RecordRestore: vi.fn(),
  RecordPurge:  vi.fn(),
  PasswordGenerate: (...args: unknown[]) => mockPasswordGenerate(...args),
}))

import { FormView } from '../views/FormView'

describe('FormView — create mode', () => {
  beforeEach(() => {
    mockRecordCreate.mockReset()
    mockRecordCreate.mockResolvedValue('new-id')
  })

  it('shows type selector in create mode', () => {
    render(<FormView onSave={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^password$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /api key/i })).toBeInTheDocument()
  })

  it('does not show type selector in edit mode', () => {
    mockRecordGet.mockResolvedValue({
      id: 'id-1', type: 'password', name: 'Site', username: 'u', password: 'p',
      username_masked: '', created_at: 0, updated_at: 0,
    })
    render(<FormView editId="id-1" onSave={vi.fn()} onBack={vi.fn()} />)
    // The toggle buttons should not be rendered in edit mode
    expect(screen.queryByRole('button', { name: /^password$/i })).not.toBeInTheDocument()
  })

  it('shows Name, Username, Password fields for password type', () => {
    render(<FormView onSave={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Username')).toBeInTheDocument()
    // 'Password' appears as both the type-selector button and the field label.
    expect(screen.getAllByText('Password').length).toBeGreaterThanOrEqual(2)
  })

  it('shows Key / Token field when API Key type is selected', async () => {
    render(<FormView onSave={vi.fn()} onBack={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /api key/i }))
    expect(screen.getByText('Key / Token')).toBeInTheDocument()
    expect(screen.queryByText('Username')).not.toBeInTheDocument()
  })

  it('shows validation error when Name is empty on submit', async () => {
    render(<FormView onSave={vi.fn()} onBack={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(mockRecordCreate).not.toHaveBeenCalled()
  })

  it('shows validation error when Username is empty (password type)', async () => {
    render(<FormView onSave={vi.fn()} onBack={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText(/e.g. github/i), 'MySite')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByText('Username is required')).toBeInTheDocument()
    expect(mockRecordCreate).not.toHaveBeenCalled()
  })

  it('shows validation error when Key/Token is empty (api_key type)', async () => {
    render(<FormView onSave={vi.fn()} onBack={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /api key/i }))
    await userEvent.type(screen.getByPlaceholderText(/e.g. openai/i), 'MyKey')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByText('Key / Token is required')).toBeInTheDocument()
    expect(mockRecordCreate).not.toHaveBeenCalled()
  })

  it('calls RecordCreate with correct data on valid submit', async () => {
    const onSave = vi.fn()
    render(<FormView onSave={onSave} onBack={vi.fn()} />)

    await userEvent.type(screen.getByPlaceholderText(/e.g. github/i), 'GitHub')
    await userEvent.type(screen.getByPlaceholderText(/e.g. user@example/i), 'user@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'mypassword')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockRecordCreate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'password', name: 'GitHub', username: 'user@example.com', password: 'mypassword' })
      )
      expect(onSave).toHaveBeenCalledWith('new-id')
    })
  })

  it('calls onBack when Cancel is clicked without saving', async () => {
    const onBack = vi.fn()
    render(<FormView onSave={vi.fn()} onBack={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onBack).toHaveBeenCalledOnce()
    expect(mockRecordCreate).not.toHaveBeenCalled()
  })
})

describe('FormView — edit mode', () => {
  beforeEach(() => {
    mockRecordGet.mockResolvedValue({
      id: 'edit-id', type: 'password', name: 'Edit Site',
      username: 'user@edit.com', password: 'edit-pass', url: 'https://edit.com',
      notes: 'edit notes', tags: ['tag1'],
      username_masked: 'use****om', created_at: 0, updated_at: 0,
    })
    mockRecordUpdate.mockResolvedValue(undefined)
  })

  it('pre-fills fields from existing record', async () => {
    render(<FormView editId="edit-id" onSave={vi.fn()} onBack={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByDisplayValue('Edit Site')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('user@edit.com')).toBeInTheDocument()
  })

  it('calls RecordUpdate (not RecordCreate) on save', async () => {
    const onSave = vi.fn()
    render(<FormView editId="edit-id" onSave={onSave} onBack={vi.fn()} />)
    await waitFor(() => screen.getByDisplayValue('Edit Site'))
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(mockRecordUpdate).toHaveBeenCalledWith('edit-id', expect.objectContaining({ name: 'Edit Site' }))
      expect(mockRecordCreate).not.toHaveBeenCalled()
      expect(onSave).toHaveBeenCalledWith('edit-id')
    })
  })
})
