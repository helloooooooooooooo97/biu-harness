import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { headingSkin } from './heading-skin.ts'
import { pageBlock } from './page-block.ts'
import { slashCommand } from './slash.ts'

export function pageEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Markdown,
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') return `标题 ${node.attrs.level}`
        return '输入 / 插入模块'
      },
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
      includeChildren: false,
    }),
    headingSkin,
    pageBlock,
    slashCommand,
  ]
}
