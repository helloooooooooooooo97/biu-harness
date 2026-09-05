import { DismissableLayer } from '@radix-ui/react-dismissable-layer'
import type { ReactElement, RefObject } from 'react'

/** 第三方 portal（日期面板、删除确认）不算点在外面。 */
export const HEADLESS_DISMISS_IGNORE =
  '.ant-picker-dropdown, .ant-picker-panel-container, .ant-select-dropdown, [data-testid="chat-session-delete-dialog"]'

function asNode(target: EventTarget | null): Node | null {
  return target instanceof Node ? target : null
}

function shouldIgnore(target: EventTarget | null, ignoreSelector: string, insideRef?: RefObject<HTMLElement | null>, inside?: (node: Node) => boolean) {
  const node = asNode(target)
  if (!node) return false
  if (insideRef?.current?.contains(node) || inside?.(node)) return true
  return Boolean(ignoreSelector && node instanceof Element && node.closest(ignoreSelector))
}

/** 无样式：点外面 / Esc 关闭。底层是 Radix DismissableLayer。 */
export function HeadlessDismiss({
  onDismiss,
  insideRef,
  inside,
  ignoreSelector = HEADLESS_DISMISS_IGNORE,
  enabled = true,
  onEscapeKeyDown,
  children,
}: {
  onDismiss: () => void
  insideRef?: RefObject<HTMLElement | null>
  inside?: (node: Node) => boolean
  ignoreSelector?: string
  enabled?: boolean
  onEscapeKeyDown?: (event: KeyboardEvent) => void
  children: ReactElement
}) {
  if (!enabled) return children
  return (
    <DismissableLayer
      asChild
      onEscapeKeyDown={onEscapeKeyDown}
      onPointerDownOutside={(event) => {
        if (shouldIgnore(event.target, ignoreSelector, insideRef, inside)) event.preventDefault()
      }}
      onFocusOutside={(event) => {
        if (shouldIgnore(event.target, ignoreSelector, insideRef, inside)) event.preventDefault()
      }}
      onDismiss={onDismiss}
    >
      {children}
    </DismissableLayer>
  )
}
