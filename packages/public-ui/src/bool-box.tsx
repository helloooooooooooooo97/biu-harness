import type { ReactNode } from 'react'

export function BoolBox({
  on,
  locked,
  children,
}: {
  on: boolean
  locked?: boolean
  children?: ReactNode
}) {
  return (
    <span className={`fsdb-boolbox${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}>{children}</span>
  )
}
