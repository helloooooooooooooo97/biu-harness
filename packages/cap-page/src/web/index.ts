import type { Context } from 'cordis'
import type { DatabaseUi } from '@biu/type-file-system/ui'
import { pagesChrome } from './chrome.tsx'
import { PageEditorService } from './service.ts'
import { PAGE_EDITOR_STYLE } from './style.ts'

export { PageEditorService, getPageEditor, usePageEditorVersion } from './service.ts'
export type { HeadingReplacement, SlashCommandSpec, SlashInsert } from './service.ts'

export const name = 'page-ui'
export const inject = ['databaseUi']

export function apply(ctx: Context) {
  new PageEditorService(ctx)
  const ui = ctx.get('databaseUi') as DatabaseUi
  ctx.effect(() => ui.decorate('/pages', pagesChrome).dispose)
}

if (typeof document !== 'undefined') {
  const id = 'biu-page-editor-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = PAGE_EDITOR_STYLE
  document.head.appendChild(style)
}
