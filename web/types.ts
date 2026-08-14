import type { SlotsService } from './ui-slots/index.ts'
import type { SnapshotService } from './runtime/snapshot.ts'

declare module 'cordis' {
  interface Context {
    slots: SlotsService
    snapshot: SnapshotService
  }
}
