import type { ReactNode } from 'react'

export type SlotKind = 'single' | 'list'

export interface SlotSpec {
  kind: SlotKind
}

export interface HostObservable<T> {
  getSnapshot(): T
  subscribe(fn: () => void): () => void
}

export type SnapshotSelectorHook<T> = <S>(sel: (state: T) => S) => S

export interface InjectFace {
  [key: string]: unknown
  hooks?: Record<string, HostObservable<unknown>>
}

export type InjectFactory = () => InjectFace

export interface RegisterOptions {
  name: string
  key?: string
  children?: Record<string, SlotSpec>
  inject?: InjectFactory
}

export type SlotComponent = (props: SlotProps) => ReactNode

export interface SlotProps {
  renderSlot: (name: string) => ReactNode
  useSnapshot: SnapshotSelectorHook<unknown>
  [key: string]: unknown
}

export interface StoredEntry {
  id: string
  name: string
  key?: string
  Component: SlotComponent
  inject?: InjectFactory
  children: string[]
}
