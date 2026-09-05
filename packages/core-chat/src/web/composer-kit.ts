import StarterKit from '@tiptap/starter-kit'
import { PickChipNode } from './composer-pick-node.tsx'

/** 输入栏与已发送气泡共用：纯段落 + 行内 pick 芯片。 */
export function composerDocExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      listKeymap: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      bold: false,
      italic: false,
      strike: false,
      code: false,
      link: false,
      underline: false,
    }),
    PickChipNode,
  ]
}
