/** 壳层图标：Heroicons 16 solid，显示 16×16。 */
export const chromeIcon = { className: 'size-4 shrink-0' } as const

export function chromeIconClass(extra?: string) {
  return extra ? `${chromeIcon.className} ${extra}` : chromeIcon.className
}
