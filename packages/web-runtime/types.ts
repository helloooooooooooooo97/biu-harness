import { SnapshotService } from './src/infrastructure/snapshot.ts'
import { SessionViewService } from './src/infrastructure/session-view.ts'
import { ProjectViewService } from './src/infrastructure/project-view.ts'
import { AppModulesService } from './src/infrastructure/app-modules.ts'
import { SlotsService } from './src/registry/slots.ts'

declare module 'cordis' {
  interface Context {
    slots: SlotsService
    snapshot: SnapshotService
    sessionView: SessionViewService
    projectView: ProjectViewService
    appModules: AppModulesService
  }
}
