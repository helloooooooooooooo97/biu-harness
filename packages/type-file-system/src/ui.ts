import type { ComponentType } from 'react'
import type { CollectionActionInfo, CollectionInfo, CollectionSchema, DbRecord, FieldSpec } from './index.ts'

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
  openRecord?: (recordId: string, collection?: string) => void
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
  /** 详情标题左侧图标。不传则用集合 glyph / 记录 emoji。 */
  Icon?: ComponentType<{ record: DbRecord }>
  Title?: ComponentType<{ record: DbRecord; label: string }>
  /** 详情标题下的主舞台（例如标签收集表）。不传则走字段概况 + 正文。 */
  Board?: ComponentType<{ record: DbRecord; openRecord?: (recordId: string, collection?: string) => void }>
  /** 正文。不传则把 content 当文件默认渲染。结构由登记方自己解析。 */
  Content?: ComponentType<FsContentProps>
  /** 详情弹窗额外分区（概况之外）。旧任务详情的脚本/进度汇报走这里。 */
  panes?: FsDetailPane[]
  /** 点行：集合自己决定跳到哪。不传则打开本表记录详情。 */
  openRow?: (row: DbRecord) => FsOpenRow | null | undefined | false
  /** 覆盖该集合侧栏/下拉里的视图列表（例如视图目录）。 */
  listViews?: (tables: CollectionInfo[], user: unknown[]) => unknown[]
  /** 从当前 URL search 解析锁定筛选（例如视图目录 ?source=）。 */
  lockedFiltersFromSearch?: (search: string) => Record<string, string>
}

export type FsOpenRow =
  | { kind: 'table'; path: string; viewId?: string }
  | { kind: 'record'; recordId: string; collection?: string }

export type FsContentProps = {
  record: DbRecord
  field: string
  spec: FieldSpec
  value: unknown
  writable?: boolean
  onChange?: (next: unknown) => void
}

/** 集合自定义呈现：谁 registerView(path)，谁才能在该 path 用这个 mode。 */
export type FsViewProps = {
  path: string
  rows: DbRecord[]
  schema?: CollectionSchema
  onOpen: (row: DbRecord) => void
}

export type CollectionViewType = {
  id: string
  label: string
  Icon?: ComponentType<{ className?: string }>
  View: ComponentType<FsViewProps>
}

export type FsFieldCellProps = {
  field: string
  spec: FieldSpec
  value: unknown
  record: DbRecord
}

export type FsFieldEditorProps = FsFieldCellProps & {
  collectionPath: string
  writable?: boolean
  onChange: (next: unknown) => void
}

/** 按 FieldSpec.type 登记的单元格 / 筛选 / 检索，而不是写进表格内核。 */
export type FieldTypeUi = {
  Cell?: ComponentType<FsFieldCellProps>
  Editor?: ComponentType<FsFieldEditorProps>
  filterLabel?: (value: string) => string
  searchText?: (value: unknown) => string
  matchesFilter?: (value: unknown, expected: string) => boolean
  hideReadOnlyDetail?: boolean
  stackDetail?: boolean
}

export interface DatabaseUi {
  decorate(path: string, chrome: CollectionChrome): { dispose: () => void }
  /** 给指定集合登记一种查看模式。其它集合看不到、也不能选。 */
  registerView(path: string, view: CollectionViewType): { dispose: () => void }
  registerFieldType(type: string, ui: FieldTypeUi): { dispose: () => void }
  fieldType(type: string): FieldTypeUi | undefined
  chrome(path: string): CollectionChrome
  views(path: string): CollectionViewType[]
  subscribe(listener: () => void): () => void
}

declare module 'cordis' {
  interface Context {
    databaseUi: DatabaseUi
  }
}
