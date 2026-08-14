import { Context } from 'cordis'
import './types.ts'
import './styles.css'
import * as slots from './ui-slots/index.ts'
import * as snapshot from './runtime/snapshot.ts'
import * as webReact from './web-react/host.ts'
import * as shell from './plugins/shell.tsx'
import * as pluginTree from './plugins/plugin-tree.tsx'
import * as eventLog from './plugins/event-log.tsx'
import * as routesPanel from './plugins/routes-panel.tsx'
import * as uiHub from './plugins/ui-hub.ts'

const el = document.getElementById('root')
if (!el) throw new Error('#root missing')

const ctx = new Context()
ctx.plugin(slots)
ctx.plugin(snapshot)
ctx.plugin(webReact, { el })
ctx.plugin(shell)
ctx.plugin(pluginTree)
ctx.plugin(eventLog)
ctx.plugin(routesPanel)
ctx.plugin(uiHub)
