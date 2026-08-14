export interface PluginRow {
  id: string
  name: string
  layer: string
  blurb: string
  inject: string[]
  togglable: boolean
  enabled: boolean
  state: string
}

export interface PageRow {
  id: string
  title: string
  subtitle: string
  plugin: string
  kind: string
}

export interface RouteRow {
  method: string
  pattern: string
}

export interface EventRow {
  ts: number
  mode: string
  name: string
  args: unknown[]
}

export interface Snapshot {
  plugins: PluginRow[]
  pages: PageRow[]
  routes: RouteRow[]
  events: EventRow[]
  services: string[]
}

export const emptySnapshot: Snapshot = {
  plugins: [],
  pages: [],
  routes: [],
  events: [],
  services: [],
}
