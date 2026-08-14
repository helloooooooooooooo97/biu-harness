import { Service, type Context } from 'cordis'
import type { ReactNode } from 'react'
import type {
  InjectFactory,
  RegisterOptions,
  SlotComponent,
  SlotKind,
  SlotSpec,
  StoredEntry,
} from './types.ts'

export type { StoredEntry, SlotSpec, SlotKind, RegisterOptions, SlotComponent, InjectFactory }

export interface SlotRenderer {
  renderRoot(host: SlotRendererHost, ownerProps: object): ReactNode
}

export interface SlotRendererHost {
  subscribe(key: string, fn: () => void): () => void
  getVersion(key: string): number
  entriesOf(key: string): readonly StoredEntry[]
  specOf(key: string): SlotSpec | undefined
}

export class SlotsService extends Service implements SlotRendererHost {
  private declared = new Map<string, SlotSpec>([['root', { kind: 'single' }]])
  private entries = new Map<string, StoredEntry[]>()
  private versions = new Map<string, number>()
  private listeners = new Map<string, Set<() => void>>()
  private renderer?: SlotRenderer
  private epoch = new Map<string, number>()

  constructor(ctx: Context) {
    super(ctx, 'slots')
  }

  install(renderer: SlotRenderer) {
    if (this.renderer) throw new Error('slots renderer already installed')
    this.renderer = renderer
  }

  renderSlot(name: string): ReactNode {
    if (name !== 'root') throw new Error("ctx.slots.renderSlot 只能渲染 'root'，其余由组件 props.renderSlot 渲染")
    if (!this.renderer) throw new Error('render before slots.install')
    return this.renderer.renderRoot(this, {})
  }

  register(options: RegisterOptions, Component: SlotComponent) {
    const { name } = options
    if (!this.declared.has(name)) {
      throw new Error(`register into undeclared slot "${name}" — 跨插件请用 ctx.slots.inject`)
    }
    return this.ctx.effect(() => {
      const entry: StoredEntry = {
        id: `${options.key ?? Component.name ?? name}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        key: options.key,
        Component,
        inject: options.inject,
        children: Object.keys(options.children ?? {}),
      }
      const list = this.entries.get(name) ?? []
      list.push(entry)
      this.entries.set(name, list)
      for (const [child, spec] of Object.entries(options.children ?? {})) {
        if (this.declared.has(child) && child !== 'root') {
          throw new Error(`slot "${child}" already declared`)
        }
        this.declared.set(child, spec)
        this.bumpEpoch(child)
        this.bump(child)
      }
      this.bump(name)
      return () => {
        this.entries.set(name, (this.entries.get(name) ?? []).filter((item) => item !== entry))
        for (const child of entry.children) {
          this.declared.delete(child)
          this.entries.delete(child)
          this.bumpEpoch(child)
          this.bump(child)
        }
        this.bump(name)
      }
    }, `slots.register ${name}`)
  }

  inject(name: string, callback: () => (() => void) | void) {
    return this.ctx.effect(() => {
      let inner: (() => void) | undefined
      let seenEpoch = -1
      const sync = () => {
        const declared = this.declared.has(name)
        const epoch = this.epoch.get(name) ?? 0
        if (!declared) {
          inner?.()
          inner = undefined
          seenEpoch = -1
          return
        }
        if (epoch === seenEpoch && inner) return
        inner?.()
        inner = undefined
        seenEpoch = epoch
        const result = callback()
        inner = typeof result === 'function' ? result : undefined
      }
      sync()
      const unsub = this.subscribe(name, sync)
      return () => {
        unsub()
        inner?.()
      }
    }, `slots.inject ${name}`)
  }

  subscribe(key: string, fn: () => void) {
    const set = this.listeners.get(key) ?? new Set()
    set.add(fn)
    this.listeners.set(key, set)
    return () => set.delete(fn)
  }

  getVersion(key: string) {
    return this.versions.get(key) ?? 0
  }

  entriesOf(key: string) {
    return this.entries.get(key) ?? []
  }

  specOf(key: string) {
    return this.declared.get(key)
  }

  private bumpEpoch(key: string) {
    this.epoch.set(key, (this.epoch.get(key) ?? 0) + 1)
  }

  private bump(key: string) {
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1)
    for (const fn of this.listeners.get(key) ?? []) fn()
    for (const fn of this.listeners.get('*') ?? []) fn()
  }
}

export const name = 'ui-slots'
export const inject = [] as const

export function apply(ctx: Context) {
  new SlotsService(ctx)
}
