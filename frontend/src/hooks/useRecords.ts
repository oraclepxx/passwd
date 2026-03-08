import { useCallback } from 'react'
import {
  RecordCreate,
  RecordList,
  RecordGet,
  RecordUpdate,
  RecordDelete,
  RecordRestore,
  RecordPurge,
} from '../../wailsjs/go/backend/App'
import type { models } from '../../wailsjs/go/models'

export type RecordSummary = models.RecordSummary
export type RecordDetail  = models.RecordDetail
export type RecordInput   = models.RecordInput
export type GeneratorOptions = models.GeneratorOptions

type GoWindow = Record<string, Record<string, Record<string, Record<string, () => Promise<RecordSummary[]>>>>>

export function useRecords() {
  const list = useCallback((query: string) => RecordList(query), [])
  const listTrash = useCallback(
    () => (window as unknown as GoWindow)['go']['backend']['App']['RecordListTrash'](),
    []
  )
  const get    = useCallback((id: string) => RecordGet(id), [])
  const create = useCallback((input: RecordInput) => RecordCreate(input), [])
  const update = useCallback((id: string, input: RecordInput) => RecordUpdate(id, input), [])
  const remove  = useCallback((id: string) => RecordDelete(id), [])
  const restore = useCallback((id: string) => RecordRestore(id), [])
  const purge   = useCallback((id: string) => RecordPurge(id), [])

  return { list, listTrash, get, create, update, remove, restore, purge }
}
