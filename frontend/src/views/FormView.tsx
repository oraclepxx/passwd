import { useState, useEffect } from 'react'
import { useRecords } from '../hooks/useRecords'
import { PasswordField } from '../components/PasswordField'

interface Props {
  editId?: string
  onSave: (id: string) => void
  onBack: () => void
}

interface FormErrors {
  name?: string
  username?: string
  password?: string
}

export function FormView({ editId, onSave, onBack }: Props) {
  const { get, create, update } = useRecords()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  // 9-4: Pre-fill fields when editing.
  useEffect(() => {
    if (!editId) return
    get(editId).then((record) => {
      setName(record.name)
      setUsername(record.username)
      setPassword(record.password)
      setUrl(record.url ?? '')
      setNotes(record.notes ?? '')
      setTags(record.tags ? record.tags.join(', ') : '')
    })
  }, [editId, get])

  // 9-5: Validate required fields — no API call if invalid.
  const validate = (): boolean => {
    const errs: FormErrors = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!username.trim()) errs.username = 'Username is required'
    if (!password) errs.password = 'Password is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const input = {
      name: name.trim(),
      username: username.trim(),
      password,
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
      tags: tags.trim() ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    }

    setSubmitting(true)
    try {
      if (editId) {
        // 9-7: Edit mode — RecordUpdate then navigate to detail.
        await update(editId, input)
        onSave(editId)
      } else {
        // 9-6: Create mode — RecordCreate then navigate to detail.
        const id = await create(input)
        onSave(id)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = (err?: string) =>
    `w-full px-3 py-2 bg-gray-900 text-white rounded-lg border text-sm
     focus:outline-none focus:border-indigo-500 placeholder-gray-600 transition-colors
     ${err ? 'border-red-500' : 'border-gray-700 hover:border-gray-600'}`

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-800/60">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-500 hover:text-white transition-colors text-sm"
        >
          ← Cancel
        </button>
        <h1 className="font-semibold text-white text-sm">
          {editId ? 'Edit record' : 'New record'}
        </h1>
        <button
          type="submit"
          form="record-form"
          disabled={submitting}
          className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                     text-white rounded-lg font-medium transition-colors"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto py-6 px-5">
        <form id="record-form" onSubmit={handleSubmit} className="max-w-md mx-auto space-y-3">

          {/* Required fields */}
          <Field label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GitHub"
              autoFocus
              className={inputCls(errors.name)}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </Field>

          <Field label="Username" required>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. user@example.com"
              className={inputCls(errors.username)}
            />
            {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username}</p>}
          </Field>

          <Field label="Password" required>
            <PasswordField
              value={password}
              onChange={setPassword}
              error={errors.password}
            />
          </Field>

          {/* Divider */}
          <div className="pt-1 border-t border-gray-800/60" />

          {/* Optional fields */}
          <Field label="URL">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              className={inputCls()}
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              rows={3}
              className={`${inputCls()} resize-none`}
            />
          </Field>

          <Field label="Tags">
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="work, personal…"
              className={inputCls()}
            />
            <p className="text-gray-600 text-xs mt-1">Comma-separated</p>
          </Field>

        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs font-medium text-gray-400 mb-1.5">
        {label}
        {required && <span className="text-indigo-400">*</span>}
      </label>
      {children}
    </div>
  )
}
