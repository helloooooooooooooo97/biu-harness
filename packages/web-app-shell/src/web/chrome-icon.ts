/** 壳层图标：Heroicons 16 solid，显示 16×16。 */
export const chromeIcon = { className: 'size-4 shrink-0' } as const
/** 侧栏项目/标签：20×20，比 16 更容易辨认。 */
export const groupIcon = { className: 'size-5 shrink-0' } as const

export function chromeIconClass(extra?: string) {
  return extra ? `${chromeIcon.className} ${extra}` : chromeIcon.className
}

export function groupIconClass(extra?: string) {
  return extra ? `${groupIcon.className} ${extra}` : groupIcon.className
}
