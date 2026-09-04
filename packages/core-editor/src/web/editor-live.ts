/** Slash 菜单挂在 window 上。隐藏检查器里的编辑器若仍触发 suggestion，会飞到视口右下角。 */
export function editorHostIsLive(editor: { isDestroyed?: boolean; isFocused?: boolean; view?: { dom?: Element | null } }) {
  if (editor.isDestroyed) return false
  const el = editor.view?.dom
  if (!(el instanceof HTMLElement) || !el.isConnected) return false
  if (el.closest('[inert], [aria-hidden="true"]')) return false
  return true
}

export function slashMayOpen(editor: { isDestroyed?: boolean; isFocused?: boolean; view?: { dom?: Element | null } } & { isActive?: (name: string) => boolean }) {
  if (!editor.isFocused) return false
  if (typeof editor.isActive === 'function' && editor.isActive('codeBlock')) return false
  return editorHostIsLive(editor)
}
