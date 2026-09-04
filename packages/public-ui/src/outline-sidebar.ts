/** 所有悬浮目录都挂在壳层左侧栏：相对 --sidebar-col 贴在栏右缘。 */
export const OUTLINE_SIDEBAR_HOST = '[data-testid="app-shell"]'

export function findOutlineSidebarHost(): HTMLElement | null {
  const el = document.querySelector(OUTLINE_SIDEBAR_HOST)
  return el instanceof HTMLElement ? el : null
}
