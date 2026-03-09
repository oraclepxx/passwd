import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ConfirmDialog } from '../components/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders the message', () => {
    render(<ConfirmDialog message="Are you sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('renders multi-line message with \\n', () => {
    render(<ConfirmDialog message={"Line one\nLine two"} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/Line one/)).toBeInTheDocument()
    expect(screen.getByText(/Line two/)).toBeInTheDocument()
  })

  it('calls onConfirm when Delete is clicked', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog message="Delete?" onConfirm={onConfirm} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog message="Delete?" onConfirm={vi.fn()} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('renders both Cancel and Delete buttons', () => {
    render(<ConfirmDialog message="?" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })
})
