/** Capture-phase：格子上的 stopPropagation 挡不住，点别处会关掉已打开的弹层。 */
export function listenOutsideDismiss(onClose: () => void, isInside: (target: Node) => boolean) {
  const onDown = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Node) || isInside(target)) return
    onClose()
  }
  document.addEventListener('mousedown', onDown, true)
  return () => document.removeEventListener('mousedown', onDown, true)
}
