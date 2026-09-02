import { useEffect } from 'react'
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { getPageEditor, usePageEditorVersion } from './service.ts'

function assetName(file: string) {
  return file.replace(/^assets\//, '')
}

async function copyPageAsset(from: string, to: string) {
  const src = assetName(from)
  const dest = assetName(to)
  const res = await fetch(`/api/page/file/${encodeURIComponent(src)}`)
  let payload: unknown = { elements: [], appState: { theme: 'dark', viewBackgroundColor: '#121212' }, files: {} }
  if (res.ok) {
    try {
      payload = JSON.parse(await res.text())
    } catch {
      /* keep empty */
    }
  }
  await fetch(`/api/page/file/${encodeURIComponent(dest)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function PageBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  usePageEditorVersion()
  const kind = String(node.attrs.kind ?? 'card')
  const data = (node.attrs.data && typeof node.attrs.data === 'object' ? node.attrs.data : {}) as Record<string, unknown>
  const spec = getPageEditor()?.block(kind)
  const cloneFrom = typeof data.cloneFrom === 'string' ? data.cloneFrom : ''
  const file = typeof data.file === 'string' ? data.file : ''
  const update = (patch: Record<string, unknown>, opts?: { replace?: boolean }) => {
    updateAttributes({ data: opts?.replace ? patch : { ...data, ...patch } })
  }
  const View = spec?.View

  useEffect(() => {
    if (!cloneFrom || !file) return
    let gone = false
    void copyPageAsset(cloneFrom, file).then(() => {
      if (gone) return
      update({ cloneFrom: undefined })
    })
    return () => {
      gone = true
    }
  }, [cloneFrom, file])

  return (
    <NodeViewWrapper
      className="page-block"
      data-page-block={kind}
      data-testid={`page-block-${kind}`}
      draggable={kind !== 'excalidraw'}
      onDragStart={kind === 'excalidraw' ? (event) => event.preventDefault() : undefined}
    >
      {cloneFrom ? (
        <div className="page-block-missing">正在复制附件…</div>
      ) : View ? (
        <View data={data} update={update} writable={editor.isEditable} />
      ) : (
        <div className="page-block-missing">未启用「{kind}」块插件</div>
      )}
    </NodeViewWrapper>
  )
}
