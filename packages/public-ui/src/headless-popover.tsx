import * as Popover from '@radix-ui/react-popover'
import type { ReactElement } from 'react'
import { HEADLESS_DISMISS_IGNORE } from './headless-dismiss.tsx'

/** 无头 Popover：自带定位、Portal、点外关闭、Esc。不带视觉样式。 */
export function HeadlessPopover({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  children,
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  modal = false,
  autoFocus = false,
  ignoreSelector = HEADLESS_DISMISS_IGNORE,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  trigger: ReactElement
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  modal?: boolean
  autoFocus?: boolean
  ignoreSelector?: string
}) {
  return (
    <Popover.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} modal={modal}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          asChild
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={8}
          onOpenAutoFocus={(event) => {
            if (!autoFocus) event.preventDefault()
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => {
            const target = event.target
            if (target instanceof Element && ignoreSelector && target.closest(ignoreSelector)) event.preventDefault()
          }}
          onFocusOutside={(event) => {
            const target = event.target
            if (target instanceof Element && ignoreSelector && target.closest(ignoreSelector)) event.preventDefault()
          }}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
