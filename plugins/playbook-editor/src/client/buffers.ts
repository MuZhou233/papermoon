/** Each editor owns a separate backup. Opening another window never overwrites it. */
import { fromDTO, type SnapshotDTO } from '../wire.ts'
import { applyOperations } from '@papermoon/playbook-core'
import { operation } from '../protocol.ts'
import type { EditableOperation } from '../protocol.ts'
export interface Backup {
  id: string
  playbookId: string
  updatedAt: number
  base: Extract<SnapshotDTO, { kind: 'draft' }>
  operations: EditableOperation[]
}
export interface Backups {
  list(playbookId: string): Promise<Backup[]>
  put(value: Backup): Promise<void>
  remove(id: string): Promise<void>
  close?(): Promise<void>
}
function validate(value: Backup): Backup {
  if (
    typeof value.id !== 'string' ||
    value.base.kind !== 'draft' ||
    value.base.draft.playbookId !== value.playbookId
  )
    throw new Error('unsupported editor backup')
  const operations = value.operations.map((op) => operation.parse(op))
  applyOperations(fromDTO(value.base.content), operations)
  return { ...value, operations }
}
export function browserBackups(): Backups {
  const ready = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('papermoon-playbook-editor')
    request.onupgradeneeded = () =>
      request.result.createObjectStore('buffers', { keyPath: 'id' })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
  void ready.catch(() => {}) // Consumers report backup failures when opening or writing a draft.
  const perform = async <T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const db = await ready
    return new Promise((resolve, reject) => {
      const tx = db.transaction('buffers', mode),
        request = action(tx.objectStore('buffers'))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }
  return {
    close: async () => {
      ;(await ready).close()
    },
    list: async (playbookId) => {
      const values = await perform('readonly', (store) => store.getAll())
      return (values as Backup[])
        .filter((v) => v.playbookId === playbookId)
        .map(validate)
        .sort((a, b) => b.updatedAt - a.updatedAt)
    },
    put: async (value) => {
      await perform('readwrite', (store) => store.put(value))
    },
    remove: async (id) => {
      await perform('readwrite', (store) => store.delete(id))
    },
  }
}
