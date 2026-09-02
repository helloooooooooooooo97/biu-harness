import { Extension } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { getPageEditor } from './service.ts'

const key = new PluginKey('heading-skin')

function headingDecorations(doc: Node) {
  const svc = getPageEditor()
  if (!svc) return DecorationSet.empty
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return
    const spec = svc.headingView(Number(node.attrs.level) || 1)
    if (!spec) return
    const attrs: Record<string, string> = {
      'data-heading-plugin': String(node.attrs.level ?? 1),
    }
    if (spec.className) attrs.class = spec.className
    if (spec.style) attrs.style = spec.style
    if (spec.label) attrs['data-heading-label'] = spec.label
    decos.push(Decoration.node(pos, pos + node.nodeSize, attrs))
  })
  return DecorationSet.create(doc, decos)
}

/** 不替换 Heading 节点，只给原生 h1/h2/h3 加 class/style。Node View 会让外层 contenteditable=false，方向键无法向上。 */
export const headingSkin = Extension.create({
  name: 'heading-skin',
  addStorage() {
    return { stop: undefined as undefined | (() => void) }
  },
  onCreate() {
    const editor = this.editor
    this.storage.stop = getPageEditor()?.subscribe(() => {
      if (editor.isDestroyed) return
      editor.view.dispatch(editor.state.tr.setMeta(key, true))
    })
  },
  onDestroy() {
    this.storage.stop?.()
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        props: {
          decorations: (state) => headingDecorations(state.doc),
        },
      }),
    ]
  },
})
