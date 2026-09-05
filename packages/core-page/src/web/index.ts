export {
  PageEditorService,
  getPageEditor,
  usePageEditorVersion,
  PageEditor,
  RecordEditor,
} from '@biu/core-editor/web'
export type { HeadingReplacement, PageBlockSpec, PageBlockViewProps, SlashCommandSpec, SlashInsert } from '@biu/core-editor/web'

export const name = 'page-ui'
export const inject = ['databaseUi']

/** 正文编辑器由 core-editor 挂到 /pages；Page 只登记表和页面存储。 */
export function apply() {}
