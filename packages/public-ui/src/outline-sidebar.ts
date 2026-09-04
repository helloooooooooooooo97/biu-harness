/** 独立挂到 body，避免 portal 进 React 管理的 app-shell 后被重绘清掉。 */
export const OUTLINE_SIDEBAR_HOST_ID = 'biu-outline-sidebar-host'

function syncSidebarCol(host: HTMLElement) {
  const shell = document.querySelector('[data-testid="app-shell"]')
  if (!(shell instanceof HTMLElement)) {
    host.style.setProperty('--sidebar-col', '0px')
    return
  }
  const col = getComputedStyle(shell).getPropertyValue('--sidebar-col').trim() || '0px'
  host.style.setProperty('--sidebar-col', col)
}

export function findOutlineSidebarHost(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  let host = document.getElementById(OUTLINE_SIDEBAR_HOST_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = OUTLINE_SIDEBAR_HOST_ID
    host.className = 'sidebar-outline-host'
    host.setAttribute('data-testid', 'outline-sidebar-host')
    document.body.append(host)
  }
  syncSidebarCol(host)
  return host
}
