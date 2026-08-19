import { Context } from 'cordis'
import './types.ts'
import './style.css'
import * as slots from './plugins/registry/slots.ts'
import * as reactHost from './plugins/orchestration/react-host.ts'
import * as shell from './plugins/orchestration/shell.tsx'
import * as nav from './plugins/contributors/nav.tsx'
import * as hello from './plugins/contributors/hello.tsx'
import * as about from './plugins/contributors/about.tsx'

const el = document.querySelector<HTMLElement>('#app')
if (!el) throw new Error('#app missing')

const ctx = new Context()
ctx.plugin(slots)
ctx.plugin(reactHost, { el })
ctx.plugin(hello)
ctx.plugin(about)
ctx.plugin(nav)
ctx.plugin(shell)
