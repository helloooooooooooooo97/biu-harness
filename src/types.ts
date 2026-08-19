import { SlotsService } from './plugins/registry/slots.ts'

declare module 'cordis' {
  interface Context {
    slots: SlotsService
  }
}
