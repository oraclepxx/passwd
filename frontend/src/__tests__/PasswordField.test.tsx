import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Wails binding before importing the component.
const mockPasswordGenerate = vi.fn()
vi.mock('../../wailsjs/go/backend/App', () => ({
  PasswordGenerate: (...args: unknown[]) => mockPasswordGenerate(...args),
}))

import { PasswordField } from '../components/PasswordField'

describe('PasswordField', () => {
  beforeEach(() => {
    mockPasswordGenerate.mockReset()
  })

  it('renders a password input (hidden by default)', () => {
    render(<PasswordField value="" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Password')
    expect(input).toHaveAttribute('type', 'password')
  })

  it('Show button reveals the password', async () => {
    render(<PasswordField value="secret123" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Password')
    expect(input).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: /show/i }))
    expect(input).toHaveAttribute('type', 'text')
  })

  it('Hide button hides the password after revealing', async () => {
    render(<PasswordField value="secret123" onChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /show/i }))
    await userEvent.click(screen.getByRole('button', { name: /hide/i }))
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('type', 'password')
  })

  it('shows error message when error prop is provided', () => {
    render(<PasswordField value="" onChange={vi.fn()} error="Password is required" />)
    expect(screen.getByText('Password is required')).toBeInTheDocument()
  })

  it('does not show error when error prop is absent', () => {
    render(<PasswordField value="" onChange={vi.fn()} />)
    expect(screen.queryByText('Password is required')).not.toBeInTheDocument()
  })

  it('Generate button opens the options panel', async () => {
    render(<PasswordField value="" onChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /generate/i }))
    expect(screen.getByRole('button', { name: /generate password/i })).toBeInTheDocument()
    expect(screen.getByRole('slider')).toBeInTheDocument() // length slider
  })

  it('Generate password button calls PasswordGenerate and fills field', async () => {
    const onChange = vi.fn()
    mockPasswordGenerate.mockResolvedValue('generated-pw-xyz')

    render(<PasswordField value="" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /generate/i }))
    await userEvent.click(screen.getByRole('button', { name: /generate password/i }))

    await waitFor(() => {
      expect(mockPasswordGenerate).toHaveBeenCalledOnce()
      expect(onChange).toHaveBeenCalledWith('generated-pw-xyz')
    })
  })

  it('calls onChange when user types in the input', async () => {
    const onChange = vi.fn()
    render(<PasswordField value="" onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText('Password'), 'a')
    expect(onChange).toHaveBeenCalled()
  })
})
