import { Markdown } from '@tiptap/markdown'
import Heading from '@tiptap/extension-heading'
import Placeholder from '@tiptap/extension-placeholder'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { HeadingView } from './heading-view.tsx'
import { getPageEditor } from './service.ts'
import { slashCommand } from './slash.ts'

export function pageEditorExtensions() {
  const editor = getPageEditor()
  const patched = Boolean(editor?.headingView(1) || editor?.headingView(2) || editor?.headingView(3))
  return [
    StarterKit.configure({
      heading: patched ? false : { levels: [1, 2, 3] },
    }),
    ...(patched
      ? [
          Heading.extend({
            addNodeView() {
              return ReactNodeViewRenderer(HeadingView)
            },
          }).configure({ levels: [1, 2, 3] }),
        ]
      : []),
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
    slashCommand,
  ]
}
