import { useSyncExternalStore } from 'react'
import type { HostObservable, SnapshotSelectorHook } from '../ui-slots/types.ts'

export function bindSnapshotSelector<T>(source: HostObservable<T>): SnapshotSelectorHook<T> {
  const subscribe = (fn: () => void) => source.subscribe(fn)
  const getSnapshot = () => source.getSnapshot()
  return function useSelector<S>(sel: (state: T) => S): S {
    return useSyncExternalStore(subscribe, () => sel(getSnapshot()))
  }
}
