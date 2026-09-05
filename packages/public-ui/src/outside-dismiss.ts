/** 兼容旧调用。新产品弹层请用 HeadlessDismiss / HeadlessPopover（Radix，无样式）。 */
export function listenOutsideDismiss(onClose: () => void, isInside: (target: Node) => boolean) {
  const onDown = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Node) || isInside(target)) return
    const active = document.activeElement
    if (active instanceof Node && isInside(active)) return
    onClose()
  }
  document.addEventListener('mousedown', onDown, true)
  return () => document.removeEventListener('mousedown', onDown, true)
}
