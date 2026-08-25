import { useSyncExternalStore } from 'react'
import { SlotEvent, type SlotEntry } from '@biu/type-slots'
import type { SlotsService } from './service.ts'

export function useSlotEntries(slots: SlotsService, name: string): SlotEntry[] {
  useSyncExternalStore(
    (fn) => slots.subscribe(name, SlotEvent.Entries, fn),
    () => slots.getVersion(name),
    () => slots.getVersion(name),
  )
  return slots.list(name)
}
