import { useSyncExternalStore } from 'react'
import { Service, type Context } from 'cordis'
import { pickKey, type PickRef } from './types.ts'

export type PickHover = { top: number; left: number; width: number; height: number }

export class PickService extends Service {
  picking = false
  refs: PickRef[] = []
  hover: PickHover | null = null
  private seq = 0
  private listeners = new Set<() => void>()

  constructor(ctx: Context) {
    super(ctx, 'pick')
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  version = () => this.seq

  enter() {
    if (this.picking) return
    this.picking = true
    this.hover = null
    this.bump()
  }

  exit() {
    if (!this.picking && !this.hover) return
    this.picking = false
    this.hover = null
    this.bump()
  }

  toggle() {
    if (this.picking) this.exit()
    else this.enter()
  }

  add(ref: PickRef) {
    const key = pickKey(ref)
    this.refs = [...this.refs.filter((item) => pickKey(item) !== key), ref]
    this.picking = false
    this.hover = null
    this.bump()
  }

  remove(key: string) {
    const next = this.refs.filter((item) => pickKey(item) !== key)
    if (next.length === this.refs.length) return
    this.refs = next
    this.bump()
  }

  clear() {
    if (!this.refs.length) return
    this.refs = []
    this.bump()
  }

  setHover(hover: PickHover | null) {
    const prev = this.hover
    if (prev === hover) return
    if (
      prev && hover
      && prev.top === hover.top && prev.left === hover.left
      && prev.width === hover.width && prev.height === hover.height
    ) return
    this.hover = hover
    this.bump()
  }

  private bump() {
    this.seq += 1
    for (const fn of this.listeners) fn()
  }
}

export function usePickState(pick?: PickService) {
  useSyncExternalStore(
    (fn) => (pick ? pick.subscribe(fn) : () => {}),
    () => pick?.version() ?? 0,
    () => 0,
  )
  return {
    picking: pick?.picking ?? false,
    refs: pick?.refs ?? [],
    hover: pick?.hover ?? null,
  }
}
