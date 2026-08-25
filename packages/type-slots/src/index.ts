import type { ComponentType, ReactNode } from 'react'

export type SlotKind = 'single' | 'list'

export const SlotEvent = {
  Open: 'open',
  Close: 'close',
  Entries: 'entries',
} as const

export type SlotEvent = (typeof SlotEvent)[keyof typeof SlotEvent]

export interface SlotSpec {
  kind: SlotKind
}

export interface FillOptions {
  key?: string
  order?: number
  props?: () => Record<string, unknown>
  children?: Record<string, SlotSpec>
}

export interface SlotEntry {
  id: string
  name: string
  order: number
  Component: ComponentType<SlotProps>
  props?: () => Record<string, unknown>
  children: string[]
}

export interface SlotProps {
  renderSlot: (name: string, options?: { kind?: SlotKind }) => ReactNode
  [key: string]: unknown
}
