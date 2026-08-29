import type { ComponentType } from 'react'
import type { CollectionActionInfo, DbRecord, FieldSpec } from './index.ts'

/** 单元格：不传则 File System 按 FieldSpec.type 默认画。 */
export type FsCellProps = {
  field: string
  spec: FieldSpec
  value: unknown
  record: DbRecord
  fallback: string
}

/** 单条动作：不传则 File System 画带 label 的文字按钮。 */
export type FsActionProps = {
  action: CollectionActionInfo
  record: DbRecord
  busy: boolean
  run: () => void
}

export type FsDetailPaneProps = {
  record: DbRecord
}

export type FsDetailPane = {
  id: string
  label: string
  badge?: (record: DbRecord) => number | string | undefined
  Pane: ComponentType<FsDetailPaneProps>
}

export type CollectionChrome = {
  cells?: Partial<Record<string, ComponentType<FsCellProps>>>
  Action?: ComponentType<FsActionProps>
  /** 标题列（labelField）在卡片/队列里也可换成自定义节点 */
  Title?: ComponentType<{ record: DbRecord; label: string }>
  /** 正文。不传则把 content 当文件默认渲染。结构由登记方自己解析。 */
  Content?: ComponentType<FsContentProps>
  /** 详情弹窗额外分区（概况之外）。旧任务详情的脚本/进度汇报走这里。 */
  panes?: FsDetailPane[]
}

export type FsContentProps = {
  record: DbRecord
  field: string
  spec: FieldSpec
  value: unknown
  writable?: boolean
  onChange?: (next: unknown) => void
}

export interface DatabaseUi {
  decorate(path: string, chrome: CollectionChrome): { dispose: () => void }
  chrome(path: string): CollectionChrome
  subscribe(listener: () => void): () => void
}

declare module 'cordis' {
  interface Context {
    databaseUi: DatabaseUi
  }
}
