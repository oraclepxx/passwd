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
  secretKey?: string
}

export function FormView({ editId, onSave, onBack }: Props) {
  const { get, create, update } = useRecords()

  const [type, setType] = useState<'password' | 'api_key'>('password')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!editId) return
    get(editId).then((record) => {
      setType(record.type === 'api_key' ? 'api_key' : 'password')
      setName(record.name)
      setUsername(record.username ?? '')
      setPassword(record.password ?? '')
      setSecretKey(record.secret_key ?? '')
      setUrl(record.url ?? '')
      setNotes(record.notes ?? '')
      setTags(record.tags ? record.tags.join(', ') : '')
    })
  }, [editId, get])

  const validate = (): boolean => {
    const errs: FormErrors = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (type === 'password') {
      if (!username.trim()) errs.username = 'Username is required'
      if (!password) errs.password = 'Password is required'
    } else {
      if (!secretKey.trim()) errs.secretKey = 'Key / Token is required'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const input = type === 'password'
      ? {
          type: 'password' as const,
          name: name.trim(),
          username: username.trim(),
          password,
          url: url.trim() || undefined,
          notes: notes.trim() || undefined,
          tags: tags.trim() ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        }
      : {
          type: 'api_key' as const,
          name: name.trim(),
          secret_key: secretKey.trim(),
          notes: notes.trim() || undefined,
          tags: tags.trim() ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        }

    setSubmitting(true)
    try {
      if (editId) {
        await update(editId, input)
        onSave(editId)
      } else {
        const id = await create(input)
        onSave(id)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = (err?: string) =>
    `w-full px-3 py-2 bg-white text-gray-900 rounded-lg border text-sm shadow-sm
     focus:outline-none focus:border-indigo-400 placeholder-gray-400 transition-colors
     ${err ? 'border-red-400' : 'border-gray-300 hover:border-gray-400'}`

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-200">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-400 hover:text-gray-700 transition-colors text-sm"
        >
          ← Cancel
        </button>
        <h1 className="font-semibold text-gray-900 text-sm">
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

          {/* Type selector — create mode only */}
          {!editId && (
            <div className="flex rounded-lg border border-gray-300 overflow-hidden mb-1 shadow-sm">
              <button
                type="button"
                onClick={() => { setType('password'); setErrors({}) }}
                className={`flex-1 py-2 text-xs font-medium transition-colors
                  ${type === 'password'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-500 hover:text-gray-700'}`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => { setType('api_key'); setErrors({}) }}
                className={`flex-1 py-2 text-xs font-medium transition-colors
                  ${type === 'api_key'
                    ? 'bg-amber-500 text-white'
                    : 'bg-white text-gray-500 hover:text-gray-700'}`}
              >
                API Key
              </button>
            </div>
          )}

          {/* Name */}
          <Field label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'api_key' ? 'e.g. OpenAI API Key' : 'e.g. GitHub'}
              autoFocus
              className={inputCls(errors.name)}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </Field>

          {/* Password-type fields */}
          {type === 'password' && (
            <>
              <Field label="Username" required>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. user@example.com"
                  className={inputCls(errors.username)}
                />
                {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
              </Field>

              <Field label="Password" required>
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  error={errors.password}
                />
              </Field>
            </>
          )}

          {/* API key field */}
          {type === 'api_key' && (
            <Field label="Key / Token" required>
              <div className={`flex items-center bg-white rounded-lg border shadow-sm transition-colors
                ${errors.secretKey ? 'border-red-400' : 'border-gray-300 hover:border-gray-400'}`}>
                <input
                  type={showSecretKey ? 'text' : 'password'}
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Paste your API key or token"
                  className="flex-1 px-3 py-2 bg-transparent text-gray-900 font-mono text-sm
                             focus:outline-none placeholder-gray-400 min-w-0"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="px-2 py-1 mr-2 text-xs text-gray-400 hover:text-gray-700 transition-colors rounded"
                >
                  {showSecretKey ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.secretKey && <p className="text-red-500 text-xs mt-1">{errors.secretKey}</p>}
            </Field>
          )}

          <div className="pt-1 border-t border-gray-200" />

          {/* URL */}
          {type === 'password' && (
            <Field label="URL">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
                className={inputCls()}
              />
            </Field>
          )}

          {/* Notes */}
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              rows={3}
              className={`${inputCls()} resize-none`}
            />
          </Field>

          {/* Tags */}
          <Field label="Tags">
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="work, personal…"
              className={inputCls()}
            />
            <p className="text-gray-400 text-xs mt-1">Comma-separated</p>
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
      <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
        {label}
        {required && <span className="text-indigo-500">*</span>}
      </label>
      {children}
    </div>
  )
}
