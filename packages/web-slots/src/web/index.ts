export type {
  SlotKind,
  SlotEvent as SlotEventName,
  SlotSpec,
  FillOptions,
  SlotEntry,
  SlotProps,
} from '@biu/type-slots'
export { SlotEvent } from '@biu/type-slots'
export { SlotsService, disposeSlot } from './service.ts'
export { useSlotEntries } from './use-slots.ts'
export { SlotOutlet } from './slot-outlet.tsx'

import type { Context } from 'cordis'
import { SlotsService } from './service.ts'

export const name = 'slots'
export const inject = [] as const

export function apply(ctx: Context) {
  new SlotsService(ctx)
}
