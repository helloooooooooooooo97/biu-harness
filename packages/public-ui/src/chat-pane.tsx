import { useEffect, useRef, type ReactNode, type Ref } from 'react'
import { ensureComposerDockFade } from './composer-dock-fade.ts'

export const CHAT_STAGE_CENTER =
  'chat-stage flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-[60px] py-3 pb-44'
export const CHAT_STAGE_PANE =
  'chat-stage flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1 py-1'
export const CHAT_DOCK_STACK = 'pointer-events-auto w-full space-y-2 bg-transparent'

function mergeRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (!ref) return
  if (typeof ref === 'function') ref(node)
  else (ref as { current: T | null }).current = node
}

export function ChatStage({
  variant = 'pane',
  children,
  className,
  stageRef,
}: {
  variant?: 'center' | 'pane'
  children?: ReactNode
  className?: string
  stageRef?: Ref<HTMLDivElement>
}) {
  const localRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    ensureComposerDockFade()
  }, [])
  const base = variant === 'center' ? CHAT_STAGE_CENTER : CHAT_STAGE_PANE
  return (
    <div
      ref={(node) => {
        localRef.current = node
        mergeRef(stageRef, node)
      }}
      className={className ? `${base} ${className}` : base}
    >
      {children}
    </div>
  )
}

export function ChatDockStack({ children }: { children?: ReactNode }) {
  useEffect(() => {
    ensureComposerDockFade()
  }, [])
  return <div className={CHAT_DOCK_STACK}>{children}</div>
}

export function ChatPane({
  thread,
  dock,
  aside,
  embed,
}: {
  thread: ReactNode
  dock?: ReactNode
  aside?: ReactNode
  embed?: boolean
}) {
  return (
    <div
      className={`chat-pane${embed ? ' chat-pane-embed' : ''}`}
      data-testid={embed ? 'session-record-chat' : 'chat-pane'}
    >
      {aside}
      <div className="chat-overlay-thread">{thread}</div>
      {dock ? <div className="chat-composer-dock">{dock}</div> : null}
    </div>
  )
}
