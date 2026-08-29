/** 与 @biu/cap-pick 的 data-biu-* 句柄对齐，Core 不依赖 pick 包。 */
export function pickDomAttrs(kind: string, id: string, label?: string) {
  return {
    'data-biu-kind': kind,
    'data-biu-id': id,
    ...(label ? { 'data-biu-label': label } : {}),
  }
}

export function recordPickKind(moduleId?: string | null) {
  const kind = String(moduleId ?? '').trim()
  return kind || 'record'
}

export function viewPickId(path: string, viewId: string) {
  return `${path}::${viewId}`
}
