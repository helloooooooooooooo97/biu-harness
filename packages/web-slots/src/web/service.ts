import { Service, type Context } from 'cordis'
import type { ComponentType } from 'react'
import type { SlotSpec, FillOptions, SlotEntry, SlotProps } from '@biu/type-slots'
import { SlotEvent } from '@biu/type-slots'

export class SlotsService extends Service {
  private declared = new Map<string, SlotSpec>([['root', { kind: 'single' }]])
  private entries = new Map<string, SlotEntry[]>()
  private versions = new Map<string, number>()
  private listeners = new Map<string, Map<SlotEvent, Set<() => void>>>()

  constructor(ctx: Context) {
    super(ctx, 'slots')
  }

  /** 未打开的缝会先 inject，打开后再 fill。 */
  place(slotName: string, Component: ComponentType<SlotProps>, options: FillOptions = {}) {
    return this.inject(slotName, () => this.fill(slotName, Component, options))
  }

  fill(slotName: string, Component: ComponentType<SlotProps>, options: FillOptions = {}) {
    if (!this.declared.has(slotName)) {
      throw new Error(`fill undeclared slot "${slotName}" — use ctx.slots.place`)
    }
    return this.ctx.effect(() => {
      const id = options.key ?? `${slotName}:${Component.displayName ?? Component.name ?? 'anon'}`
      const list = this.entries.get(slotName) ?? []
      if (list.some((item) => item.id === id)) {
        throw new Error(`slot "${slotName}" already has "${id}"`)
      }
      const children = Object.keys(options.children ?? {})
      const entry: SlotEntry = {
        id,
        name: slotName,
        order: options.order ?? 0,
        Component,
        props: options.props,
        children,
      }
      list.push(entry)
      this.entries.set(slotName, list)
      for (const [child, spec] of Object.entries(options.children ?? {})) {
        if (this.declared.has(child) && child !== 'root') {
          throw new Error(`slot "${child}" already declared`)
        }
        this.declared.set(child, spec)
        this.emit(child, SlotEvent.Open)
      }
      this.emit(slotName, SlotEvent.Entries)
      return () => {
        this.entries.set(slotName, (this.entries.get(slotName) ?? []).filter((item) => item !== entry))
        for (const child of entry.children) {
          this.declared.delete(child)
          this.entries.delete(child)
          this.emit(child, SlotEvent.Close)
          this.emit(child, SlotEvent.Entries)
        }
        this.emit(slotName, SlotEvent.Entries)
      }
    }, `slots.fill ${slotName}:${options.key ?? Component.name}`)
  }

  inject(slotName: string, callback: () => (() => void) | void) {
    return this.ctx.effect(() => {
      let inner: (() => void) | undefined
      const attach = () => {
        detach()
        const result = callback()
        inner = typeof result === 'function' ? result : undefined
      }
      const detach = () => {
        inner?.()
        inner = undefined
      }
      if (this.declared.has(slotName)) attach()
      const stopOpen = this.subscribe(slotName, SlotEvent.Open, attach)
      const stopClose = this.subscribe(slotName, SlotEvent.Close, detach)
      return () => {
        stopOpen()
        stopClose()
        detach()
      }
    }, `slots.inject ${slotName}`)
  }

  specOf(name: string) {
    return this.declared.get(name)
  }

  subscribe(name: string, event: SlotEvent, fn: () => void) {
    const byEvent = this.listeners.get(name) ?? new Map<SlotEvent, Set<() => void>>()
    const set = byEvent.get(event) ?? new Set()
    set.add(fn)
    byEvent.set(event, set)
    this.listeners.set(name, byEvent)
    return () => set.delete(fn)
  }

  getVersion(name: string) {
    return this.versions.get(name) ?? 0
  }

  list(name: string) {
    return [...(this.entries.get(name) ?? [])]
  }

  private emit(name: string, event: SlotEvent) {
    if (event === SlotEvent.Entries) {
      this.versions.set(name, (this.versions.get(name) ?? 0) + 1)
    }
    for (const fn of this.listeners.get(name)?.get(event) ?? []) fn()
  }
}
