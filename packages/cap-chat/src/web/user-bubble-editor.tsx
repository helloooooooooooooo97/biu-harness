import { memo, useMemo } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { composerDocExtensions } from './composer-kit.ts'
import { jsonFromDraft } from './composer-tiptap.ts'

/** 已发送用户消息：与输入栏同一套 Tiptap 文档，只读。 */
export const UserBubbleEditor = memo(function UserBubbleEditor({ text }: { text: string }) {
  const content = useMemo(() => jsonFromDraft(text), [text])
  const editor = useEditor({
    immediatelyRender: true,
    editable: false,
    extensions: composerDocExtensions(),
    content,
    editorProps: {
      attributes: {
        class: 'composer-tiptap is-readonly',
      },
    },
  })
  return <EditorContent editor={editor} />
})
