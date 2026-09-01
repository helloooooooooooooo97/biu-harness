import { useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import { Service, type Context } from 'cordis'

export type HeadingViewProps = {
  level: HeadingLevel
  children?: ReactNode
}

export type HeadingReplacement = {
  View: ComponentType<HeadingViewProps>
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

export type HeadingLevel = 1 | 2 | 3

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

  /** 用商店插件的 React 组件替换原生 H1 / H2 / H3 外观。卸载插件后恢复。 */
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

  /** 增补或覆盖斜杠菜单项。不要传 TipTap 对象，只用 insert 声明要变成哪种块。 */
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
