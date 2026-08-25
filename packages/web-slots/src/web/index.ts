export type {
  SlotKind,
  SlotEvent as SlotEventName,
  SlotSpec,
  FillOptions,
  SlotEntry,
  SlotProps,
} from '@biu/type-slots'
export { SlotEvent } from '@biu/type-slots'
export { SlotsService } from './service.ts'
export { useSlotEntries } from './use-slots.ts'

import type { Context } from 'cordis'
import { SlotsService } from './service.ts'

export const name = 'slots'
export const inject = [] as const

export function apply(ctx: Context) {
  new SlotsService(ctx)
}
