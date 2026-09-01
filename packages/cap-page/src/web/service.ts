import { useSyncExternalStore } from 'react'
import { Service, type Context } from 'cordis'

export type HeadingLevel = 1 | 2 | 3

export type HeadingReplacement = {
  className?: string
  style?: string
  label?: string
}

export type SlashInsert =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet'
  | 'ordered'
  | 'quote'
  | 'code'
  | 'divider'

export type SlashCommandSpec = {
  id: string
  label?: string
  hint?: string
  aliases?: string[]
  insert?: SlashInsert
}

let bound: PageEditorService | undefined

export function getPageEditor() {
  return bound
}

export class PageEditorService extends Service {
  private headings = new Map<HeadingLevel, HeadingReplacement>()
  private extras: SlashCommandSpec[] = []
  private seq = 0
  private listeners = new Set<() => void>()

  constructor(ctx: Context) {
    super(ctx, 'pageEditor')
    bound = this
    ctx.effect(() => () => {
      if (bound === this) bound = undefined
    })
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  version = () => this.seq

  headingView(level: number) {
    return this.headings.get(level as HeadingLevel)
  }

  slashCommands() {
    return [...this.extras]
  }

  /** 给原生 H1 / H2 / H3 加皮肤（class/style/::before 标签）。不要包 Node View，否则方向键无法向上。 */
  replaceHeading(level: HeadingLevel, spec: HeadingReplacement) {
    return this.ctx.effect(() => {
      this.headings.set(level, spec)
      this.bump()
      return () => {
        if (this.headings.get(level) === spec) this.headings.delete(level)
        this.bump()
      }
    })
  }

  slash(spec: SlashCommandSpec) {
    return this.ctx.effect(() => {
      this.extras = [...this.extras.filter((item) => item.id !== spec.id), spec]
      this.bump()
      return () => {
        this.extras = this.extras.filter((item) => item !== spec)
        this.bump()
      }
    })
  }

  private bump() {
    this.seq += 1
    for (const fn of this.listeners) fn()
  }
}

export function usePageEditorVersion(editor?: PageEditorService) {
  const svc = editor ?? bound
  return useSyncExternalStore(
    (fn) => (svc ? svc.subscribe(fn) : () => undefined),
    () => svc?.version() ?? 0,
    () => 0,
  )
}

declare module 'cordis' {
  interface Context {
    pageEditor: PageEditorService
  }
}
