import { Fragment, memo, useMemo } from 'react'
import { PickChip, splitPickStream } from '@biu/cap-pick/web'

/** 已发送用户消息：静态渲染，不挂 Tiptap，避免切回聊天时每条消息都新建编辑器。 */
export const UserBubbleEditor = memo(function UserBubbleEditor({ text }: { text: string }) {
  const parts = useMemo(() => splitPickStream(text), [text])
  return (
    <div className="composer-tiptap is-readonly">
      {parts.map((part, index) => {
        if (part.type === 'pick') {
          const pick = part.ref
          return (
            <span key={`p${index}`} className="composer-inline-chip">
              <PickChip pick={pick} />
            </span>
          )
        }
        const lines = part.value.split('\n')
        return (
          <Fragment key={`t${index}`}>
            {lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex ? <br /> : null}
                {line}
              </Fragment>
            ))}
          </Fragment>
        )
      })}
    </div>
  )
})
