import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { RecordCard } from '../components/RecordCard'
import type { RecordSummary } from '../hooks/useRecords'

const passwordRecord: RecordSummary = {
  id: 'id-1',
  type: 'password',
  name: 'GitHub',
  username_masked: 'use***om',
  created_at: 0,
  updated_at: 0,
}

const apiKeyRecord: RecordSummary = {
  id: 'id-2',
  type: 'api_key',
  name: 'OpenAI Key',
  username_masked: '',
  created_at: 0,
  updated_at: 0,
}

describe('RecordCard', () => {
  it('renders record name', () => {
    render(<RecordCard record={passwordRecord} onClick={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('GitHub')).toBeInTheDocument()
  })

  it('renders Password badge for password type', () => {
    render(<RecordCard record={passwordRecord} onClick={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Password')).toBeInTheDocument()
  })

  it('renders API Key badge for api_key type', () => {
    render(<RecordCard record={apiKeyRecord} onClick={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('API Key')).toBeInTheDocument()
  })

  it('renders masked username for password type', () => {
    render(<RecordCard record={passwordRecord} onClick={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('use***om')).toBeInTheDocument()
  })

  it('does not render username for api_key type', () => {
    render(<RecordCard record={apiKeyRecord} onClick={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('use***om')).not.toBeInTheDocument()
  })

  it('calls onClick with record id when main area is clicked', async () => {
    const onClick = vi.fn()
    render(<RecordCard record={passwordRecord} onClick={onClick} onEdit={vi.fn()} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByText('GitHub'))
    expect(onClick).toHaveBeenCalledWith('id-1')
  })

  it('opens actions menu when ⋮ button is clicked', async () => {
    render(<RecordCard record={passwordRecord} onClick={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const menuBtn = screen.getByLabelText('Actions')
    await userEvent.click(menuBtn)
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls onEdit with record id when Edit is clicked', async () => {
    const onEdit = vi.fn()
    render(<RecordCard record={passwordRecord} onClick={vi.fn()} onEdit={onEdit} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('Actions'))
    await userEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledWith('id-1')
  })

  it('calls onDelete with record id when Delete is clicked', async () => {
    const onDelete = vi.fn()
    render(<RecordCard record={passwordRecord} onClick={vi.fn()} onEdit={vi.fn()} onDelete={onDelete} />)
    await userEvent.click(screen.getByLabelText('Actions'))
    await userEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledWith('id-1')
  })
})
