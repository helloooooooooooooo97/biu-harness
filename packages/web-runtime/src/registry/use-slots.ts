import { useSyncExternalStore } from 'react'
import { SlotEvent, type SlotEntry, type SlotsService } from './slots.ts'

export function useSlotEntries(slots: SlotsService, name: string): SlotEntry[] {
  useSyncExternalStore(
    (fn) => slots.subscribe(name, SlotEvent.Entries, fn),
    () => slots.getVersion(name),
    () => slots.getVersion(name),
  )
  return slots.list(name)
}
