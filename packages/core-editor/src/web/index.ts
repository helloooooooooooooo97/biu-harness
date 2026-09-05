import type { Context } from 'cordis'
import type { DatabaseUi } from '@biu/type-file-system/ui'
import { PageEditor } from './page-editor.tsx'
import { PageEditorService } from './service.ts'
import { PAGE_EDITOR_STYLE } from './style.ts'

export { PageEditor, PageEditor as RecordEditor } from './page-editor.tsx'
export { PageEditorService, getPageEditor, usePageEditorVersion } from './service.ts'
export type { HeadingReplacement, PageBlockSpec, PageBlockViewProps, SlashCommandSpec, SlashInsert } from './service.ts'
export { pageEditorExtensions } from './kit.ts'

export const name = 'core-editor-ui'
export const inject = ['databaseUi']

const EDITOR_COLLECTIONS = ['/pages', '/tasks', '/plugins', '/facets'] as const

export function apply(ctx: Context) {
  new PageEditorService(ctx)
  const ui = ctx.get('databaseUi') as DatabaseUi
  for (const path of EDITOR_COLLECTIONS) {
    ctx.effect(() => ui.decorate(path, { Content: PageEditor }).dispose)
  }
}

if (typeof document !== 'undefined') {
  const id = 'biu-core-editor-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = PAGE_EDITOR_STYLE
  document.head.appendChild(style)
}
