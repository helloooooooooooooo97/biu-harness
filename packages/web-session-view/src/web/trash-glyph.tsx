import type { SVGProps } from 'react'

/** 实心垃圾桶：盖 + 桶身，没有 Heroicons 那两条内槽。 */
export function TrashGlyph({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      data-slot="icon"
      className={className ?? 'size-4 shrink-0'}
      {...props}
    >
      <path d="M6.35 1.5h3.3c.33 0 .62.2.73.5l.32 1h2.55a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5h2.55l.32-1c.11-.3.4-.5.73-.5ZM4.15 5.5h7.7l-.48 8.08A1.6 1.6 0 0 1 9.78 15H6.22a1.6 1.6 0 0 1-1.59-1.42L4.15 5.5Z" />
    </svg>
  )
}
