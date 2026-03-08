import { useState } from 'react'
import { useVault } from './hooks/useVault'
import { LockView } from './views/LockView'
import { ListView } from './views/ListView'
import { DetailView } from './views/DetailView'
import { FormView } from './views/FormView'
import { TrashView } from './views/TrashView'
import { ChangePasswordView } from './views/ChangePasswordView'

type View =
  | { name: 'list' }
  | { name: 'trash' }
  | { name: 'changePassword' }
  | { name: 'detail'; id: string }
  | { name: 'form'; editId?: string }

function App() {
  const { isUnlocked, createVault, unlock, lock } = useVault()
  const [view, setView] = useState<View>({ name: 'list' })

  if (!isUnlocked) {
    return (
      <LockView
        onUnlocked={() => setView({ name: 'list' })}
        createVault={createVault}
        unlock={unlock}
      />
    )
  }

  if (view.name === 'detail') {
    return (
      <DetailView
        id={view.id}
        onEdit={() => setView({ name: 'form', editId: view.id })}
        onBack={() => setView({ name: 'list' })}
      />
    )
  }

  if (view.name === 'form') {
    return (
      <FormView
        editId={view.editId}
        onSave={(id) => setView(view.editId ? { name: 'detail', id } : { name: 'list' })}
        onBack={() => setView(view.editId ? { name: 'detail', id: view.editId } : { name: 'list' })}
      />
    )
  }

  if (view.name === 'trash') {
    return <TrashView onBack={() => setView({ name: 'list' })} />
  }

  if (view.name === 'changePassword') {
    return <ChangePasswordView onBack={() => setView({ name: 'list' })} />
  }

  return (
    <ListView
      onSelect={(id) => setView({ name: 'detail', id })}
      onNew={() => setView({ name: 'form' })}
      onTrash={() => setView({ name: 'trash' })}
      onSettings={() => setView({ name: 'changePassword' })}
      onLock={lock}
    />
  )
}

export default App
