/** 壳层描边/实心图标：统一 16×16。 */
export const chromeIcon = { className: 'size-4 shrink-0' } as const

export function chromeIconClass(extra?: string) {
  return extra ? `${chromeIcon.className} ${extra}` : chromeIcon.className
}
