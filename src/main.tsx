import { Context } from 'cordis'
import './types.ts'
import './style.css'
import * as slots from './plugins/registry/slots.ts'
import * as snapshot from './plugins/infrastructure/snapshot.ts'
import * as reactHost from './plugins/infrastructure/react-host.ts'
import * as shell from './plugins/contributors/shell.tsx'
import * as pluginTree from './plugins/contributors/plugin-tree.tsx'
import * as eventLog from './plugins/contributors/event-log.tsx'
import * as routesPanel from './plugins/contributors/routes-panel.tsx'
import * as uiHub from './plugins/orchestration/ui-hub.ts'

const el = document.querySelector<HTMLElement>('#app')
if (!el) throw new Error('#app missing')

const ctx = new Context()
ctx.plugin(slots)
ctx.plugin(snapshot)
ctx.plugin(reactHost, { el })
ctx.plugin(shell)
ctx.plugin(pluginTree)
ctx.plugin(eventLog)
ctx.plugin(routesPanel)
ctx.plugin(uiHub)
