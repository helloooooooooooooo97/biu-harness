import { SnapshotService } from './plugins/infrastructure/snapshot.ts'
import { SlotsService } from './plugins/registry/slots.ts'

declare module 'cordis' {
  interface Context {
    slots: SlotsService
    snapshot: SnapshotService
  }
}
