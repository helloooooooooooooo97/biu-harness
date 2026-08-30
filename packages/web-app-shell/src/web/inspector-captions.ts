export type InspectorCaption = {
  label: string
  kind?: string
  mode?: string
  icon?: string
  emoji?: string
}

const captions = new Map<string, InspectorCaption>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version += 1
  for (const fn of listeners) fn()
}

function onCaption(event: Event) {
  const detail = (event as CustomEvent).detail as { id?: unknown; label?: unknown; kind?: unknown; mode?: unknown; icon?: unknown; emoji?: unknown } | undefined
  const id = typeof detail?.id === 'string' ? detail.id : ''
  if (!id) return
  const label = typeof detail?.label === 'string' ? detail.label.trim() : ''
  if (!label) {
    captions.delete(id)
    emit()
    return
  }
  captions.set(id, {
    label,
    kind: typeof detail?.kind === 'string' ? detail.kind : undefined,
    mode: typeof detail?.mode === 'string' ? detail.mode : undefined,
    icon: typeof detail?.icon === 'string' ? detail.icon : undefined,
    emoji: typeof detail?.emoji === 'string' ? detail.emoji : undefined,
  })
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('biu:inspector-caption', onCaption)
}

export function subscribeInspectorCaptions(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function getInspectorCaptionVersion() {
  return version
}

export function getInspectorCaption(id: string) {
  return captions.get(id)
}

export function reportInspectorCaption(id: string, caption: InspectorCaption | null) {
  window.dispatchEvent(
    new CustomEvent('biu:inspector-caption', {
      detail: caption ? { id, ...caption } : { id, label: '' },
    }),
  )
}
