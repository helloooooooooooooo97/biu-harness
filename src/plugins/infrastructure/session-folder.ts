/** Minimal File System Access API types (Chromium). 仅保留类型与可选浏览器能力探测；Agent 工作区绑定走 host 绝对路径。 */
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

export function canPickDirectory() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}
