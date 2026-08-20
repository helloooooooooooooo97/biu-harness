/** Minimal File System Access API types (Chromium). */
export interface FsFileHandle {
  kind: 'file'
  name: string
  getFile(): Promise<File>
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
}

export interface FsDirHandle {
  kind: 'directory'
  name: string
  values(): AsyncIterableIterator<FsFileHandle | FsDirHandle>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsDirHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsFileHandle>
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FsDirHandle>
  }
}

const DB_NAME = 'cordis-session-projects'
const STORE = 'handles'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('idb open failed'))
  })
}

export async function saveSessionDirHandle(sessionId: string, handle: FsDirHandle) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(handle, sessionId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('idb put failed'))
  })
  db.close()
}

export async function loadSessionDirHandle(sessionId: string): Promise<FsDirHandle | undefined> {
  const db = await openDb()
  const handle = await new Promise<FsDirHandle | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(sessionId)
    req.onsuccess = () => resolve(req.result as FsDirHandle | undefined)
    req.onerror = () => reject(req.error ?? new Error('idb get failed'))
  })
  db.close()
  return handle
}

export async function deleteSessionDirHandle(sessionId: string) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(sessionId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('idb delete failed'))
  })
  db.close()
}

export function canPickDirectory() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export async function pickDirectory(): Promise<FsDirHandle> {
  if (!canPickDirectory()) {
    throw new Error('当前浏览器不支持打开本地文件夹（需要 Chromium 系）')
  }
  return window.showDirectoryPicker!({ mode: 'readwrite' })
}

export interface DirEntry {
  name: string
  path: string
  kind: 'file' | 'directory'
}

export async function listDirectory(dir: FsDirHandle, prefix = ''): Promise<DirEntry[]> {
  const rows: DirEntry[] = []
  for await (const entry of dir.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    rows.push({ name: entry.name, path, kind: entry.kind })
  }
  rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return rows
}

export async function resolveDir(root: FsDirHandle, dirPath: string): Promise<FsDirHandle> {
  if (!dirPath) return root
  let cur = root
  for (const part of dirPath.split('/').filter(Boolean)) {
    cur = await cur.getDirectoryHandle(part)
  }
  return cur
}

export async function readTextFile(root: FsDirHandle, filePath: string): Promise<string> {
  const parts = filePath.split('/').filter(Boolean)
  const name = parts.pop()
  if (!name) throw new Error('empty path')
  const dir = await resolveDir(root, parts.join('/'))
  const file = await (await dir.getFileHandle(name)).getFile()
  return file.text()
}

export async function writeTextFile(root: FsDirHandle, filePath: string, text: string) {
  const parts = filePath.split('/').filter(Boolean)
  const name = parts.pop()
  if (!name) throw new Error('empty path')
  const dir = await resolveDir(root, parts.join('/'))
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
}
