import { existsSync, readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import type { Plugin as EsbuildPlugin } from 'esbuild'
import { declaredStoreShell, parseStoreShell, requireDeclaredShell, type StoreShell } from '../shell.ts'

export type PluginCreateInput = {
  id: string
  name: string
  blurb?: string
  tags?: string[]
  author?: string
  authorUrl?: string
  headless?: boolean
  shell?: StoreShell | Record<string, unknown>
  hostJs?: string
  webJs?: string
}

export type StoreManifestFields = {
  id: string
  name: string
  blurb: string
  tags: string[]
  author: string
  authorUrl: string
  createdAt: number
  headless?: boolean
  shell?: StoreShell
}

export function parseTags(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，]/)
      : []
  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))]
}

export function buildStoreManifest(
  input: Pick<PluginCreateInput, 'id' | 'name' | 'blurb' | 'tags' | 'author' | 'authorUrl' | 'shell' | 'headless'>,
  existing?: Partial<StoreManifestFields>,
  now = Date.now(),
): StoreManifestFields {
  const createdAt = Number(existing?.createdAt)
  const headless = Boolean(input.headless ?? existing?.headless)
  return {
    id: String(input.id).trim(),
    name: String(input.name).trim(),
    blurb: String(input.blurb ?? existing?.blurb ?? '').trim() || String(input.name).trim(),
    tags: input.tags?.length ? parseTags(input.tags) : parseTags(existing?.tags),
    author: String(input.author ?? existing?.author ?? '').trim(),
    authorUrl: String(input.authorUrl ?? existing?.authorUrl ?? '').trim(),
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : now,
    ...(headless ? { headless: true } : {}),
    ...(!headless && declaredStoreShell(input.shell ?? existing?.shell)
      ? { shell: parseStoreShell(input.shell ?? existing?.shell) }
      : {}),
  }
}

export function parseStoreManifest(raw: unknown): StoreManifestFields {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const id = String(data.id ?? '').trim()
  const name = String(data.name ?? '').trim()
  if (!id || !name) throw new Error('invalid plugin manifest')
  const createdAt = Number(data.createdAt)
  return buildStoreManifest(
    {
      id,
      name,
      blurb: data.blurb != null ? String(data.blurb) : undefined,
      tags: parseTags(data.tags),
      author: data.author != null ? String(data.author) : undefined,
      authorUrl: data.authorUrl != null ? String(data.authorUrl) : data.author_url != null ? String(data.author_url) : undefined,
      headless: data.headless === true,
      shell: data.shell,
    },
    { createdAt },
    Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
  )
}

const HOST_ENTRIES = ['host.ts', 'host.tsx', 'host.js']
const WEB_ENTRIES = ['web.tsx', 'web.ts', 'web.js']

export function findEntry(dir: string, names: string[]) {
  return names.map((name) => join(dir, name)).find((path) => existsSync(path)) ?? null
}

/** 单文件 TS/TSX → ESM（无 bundle）。 */
export async function compileStoreModule(source: string, kind: 'host' | 'web') {
  const trimmed = source.trim()
  if (!trimmed) throw new Error(`${kind} source is empty`)
  const { transform } = await import('esbuild')
  const result = await transform(trimmed, {
    loader: kind === 'web' ? 'tsx' : 'ts',
    format: 'esm',
    target: 'es2022',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    tsconfigRaw: '{"compilerOptions":{"jsx":"react"}}',
    sourcemap: false,
  })
  return finishBundle(result.code, kind)
}

function mimeForAsset(file: string) {
  const ext = extname(file).toLowerCase()
  if (ext === '.woff2') return 'font/woff2'
  if (ext === '.woff') return 'font/woff'
  if (ext === '.ttf') return 'font/ttf'
  if (ext === '.otf') return 'font/otf'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.css') return 'text/css'
  return 'application/octet-stream'
}

function inlineCssUrls(css: string, cssFile: string) {
  return css.replace(/url\((['"]?)(\.[^'")]+)\1\)/g, (_all, _q: string, rel: string) => {
    const file = resolve(dirname(cssFile), rel)
    const buf = readFileSync(file)
    return `url(data:${mimeForAsset(file)};base64,${buf.toString('base64')})`
  })
}

function namedFrom(globalExpr: string, names: string[]) {
  return `const G = ${globalExpr}
export default G
${names.map((name) => `export const ${name} = G.${name}`).join('\n')}
`
}

function reactShim(spec: string) {
  if (spec === 'react/jsx-runtime' || spec === 'react/jsx-dev-runtime') {
    return `const R = globalThis.React
const J = globalThis.ReactJSXRuntime
export const Fragment = (J && J.Fragment) || R.Fragment
export const jsx = J && J.jsx ? J.jsx : (type, props, key) => R.createElement(type, key == null ? props : { ...props, key })
export const jsxs = J && J.jsxs ? J.jsxs : jsx
export const jsxDEV = J && (J.jsxDEV || J.jsx) ? (J.jsxDEV || J.jsx) : jsx
`
  }
  if (spec === 'react-dom' || spec.startsWith('react-dom/')) {
    return namedFrom('globalThis.ReactDOM', [
      'createPortal',
      'createRoot',
      'findDOMNode',
      'flushSync',
      'hydrate',
      'hydrateRoot',
      'render',
      'unmountComponentAtNode',
      'unstable_batchedUpdates',
      'unstable_renderSubtreeIntoContainer',
      'version',
    ])
  }
  return namedFrom('globalThis.React', [
    'Children',
    'Component',
    'Fragment',
    'Profiler',
    'PureComponent',
    'StrictMode',
    'Suspense',
    'cloneElement',
    'createContext',
    'createElement',
    'createFactory',
    'createRef',
    'forwardRef',
    'isValidElement',
    'lazy',
    'memo',
    'startTransition',
    'unstable_act',
    'use',
    'useActionState',
    'useCallback',
    'useContext',
    'useDebugValue',
    'useDeferredValue',
    'useEffect',
    'useEffectEvent',
    'useId',
    'useImperativeHandle',
    'useInsertionEffect',
    'useLayoutEffect',
    'useMemo',
    'useOptimistic',
    'useReducer',
    'useRef',
    'useState',
    'useSyncExternalStore',
    'useTransition',
    'version',
  ])
}

function storeBundlePlugins(kind: 'host' | 'web'): EsbuildPlugin[] {
  const plugins: EsbuildPlugin[] = [
    {
      name: 'store-no-biu',
      setup(build) {
        build.onResolve({ filter: /^@biu\// }, (args) => ({
          errors: [{ text: `store plugins cannot import ${args.path}; inject the host service instead` }],
          path: args.path,
        }))
      },
    },
  ]
  if (kind !== 'web') return plugins
  plugins.push({
    name: 'store-host-react',
    setup(build) {
      build.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (args) => ({
        path: args.path,
        namespace: 'host-react',
      }))
      build.onLoad({ filter: /.*/, namespace: 'host-react' }, (args) => ({
        contents: reactShim(args.path),
        loader: 'js',
      }))
    },
  })
  plugins.push({
    name: 'store-css',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, (args) => {
        const css = inlineCssUrls(readFileSync(args.path, 'utf8'), args.path)
        const id = `store-css-${Buffer.from(args.path).toString('base64url').slice(0, 24)}`
        return {
          contents: `if (typeof document !== "undefined" && !document.getElementById(${JSON.stringify(id)})) {
  const el = document.createElement("style")
  el.id = ${JSON.stringify(id)}
  el.textContent = ${JSON.stringify(css)}
  document.head.appendChild(el)
}
`,
          loader: 'js',
        }
      })
    },
  })
  return plugins
}

/** 沙箱入口打包：相对 import + npm（react / @biu/* 除外）。 */
export async function bundleStoreEntry(entryFile: string, kind: 'host' | 'web') {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: dirname(entryFile),
    entryPoints: [entryFile],
    bundle: true,
    minify: true,
    legalComments: 'none',
    write: false,
    format: 'esm',
    platform: kind === 'host' ? 'node' : 'browser',
    target: 'es2022',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    tsconfigRaw: '{"compilerOptions":{"jsx":"react"}}',
    logLevel: 'silent',
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.IS_PREACT': 'false',
    },
    conditions: ['production', 'import', 'module', 'browser', 'default'],
    plugins: storeBundlePlugins(kind),
  })
  const text = result.outputFiles?.[0]?.text
  if (!text?.trim()) throw new Error(`${kind} bundle is empty`)
  return finishBundle(text, kind)
}

function finishBundle(code: string, kind: 'host' | 'web') {
  let out = code.trim()
  if (kind === 'web' && /React\.createElement/.test(out) && !out.includes('globalThis.React')) {
    out = `const React = globalThis.React\n${out}`
  }
  return out.endsWith('\n') ? out : `${out}\n`
}

export async function readSandboxManifest(dir: string) {
  const raw = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as unknown
  return parseStoreManifest(raw)
}

const CONTRACT = [
  '契约：id 与 export const name 相同。可以 import npm，pack 会打进 host.js/web.js。不要 import react / react-dom / @biu/*：Web 用宿主 globalThis.React、ReactDOM 与 ReactJSXRuntime；宿主服务用 inject。有 npm 依赖请用 db_action /plugins/<id> action=sandbox，再用 action=pack（create 只做单文件、不解析 node_modules）。不要改 packages/ 或 cordis.plugins.json。',
  '有窗口的 Web：ctx.slots.place("plugin-store-extras", Comp, { key, props: () => ({ Icon }) })。Icon 可选。运行窗口会给 extras 套操纵栏（关/缩；resizable 才有全屏），key 尽量用插件 id。',
  '无头插件：manifest 写 headless: true。有 web 也不要 shell，不要 place plugin-store-extras，不要操纵栏。只在 apply 里登记服务（如 pageEditor）。',
  '有窗口的 web 必须在 manifest / 本动作 shell 参数里写 width 与 height。无头插件不要写 shell。',
  '/plugins 列表没有 listing.shell 对象，只有扁平字段 shellWidth、shellHeight、shellMinWidth、shellMinHeight、shellResizable、headless。有窗口时用 storeShellFromRecord 读尺寸。',
].join(' ')

export const PLUGIN_CREATE_DESCRIPTION = [
  '这是安装插件，不是新建代理。用户说「再开一个 agent」请 db_create /sessions。',
  '直写已安装插件：单文件小插件。把 host/web 源码放进 args，立刻编译进 .plugin/<id>/，插件列表就能看到。',
  '适合一两百行、无相对 import、无多文件。更大或要拆文件请改用 sandbox + pack。',
  CONTRACT,
].join(' ')

export const PLUGIN_SANDBOX_DESCRIPTION = [
  '开沙箱：多文件/大插件。只建/更新 .plugin-dev/<id>/（manifest.json，可选起点 host.ts / web.tsx），不进已安装目录。',
  '然后用 bash / 文件工具在沙箱里写代码、相对 import。调完必须 db_action action=pack 才会打进 .plugin/<id>/。',
  '卸载删 .plugin/<id>/，沙箱还在。',
  CONTRACT,
].join(' ')

export const PLUGIN_PACK_DESCRIPTION = [
  '把 .plugin-dev/<id>/ 沙箱打包进 .plugin/<id>/（manifest.json + bundle 后的 host.js / web.js）。',
  '入口：host.ts|tsx|js 与 web.tsx|ts|js，至少要有一个。有窗口的 web 必须已写 shell.width/height；无头插件写 headless: true 即可。已打开的插件会重新挂上。',
].join(' ')

export function createArgs(args: Record<string, unknown>): PluginCreateInput {
  return {
    id: String(args.id ?? ''),
    name: String(args.name ?? ''),
    blurb: args.blurb != null ? String(args.blurb) : undefined,
    tags: parseTags(args.tags),
    author: args.author != null ? String(args.author) : undefined,
    authorUrl: args.authorUrl != null ? String(args.authorUrl) : undefined,
    headless: args.headless === true,
    shell: args.shell && typeof args.shell === 'object' ? (args.shell as Record<string, unknown>) : undefined,
    hostJs: args.hostJs != null ? String(args.hostJs) : undefined,
    webJs: args.webJs != null ? String(args.webJs) : undefined,
  }
}

const ID_NAME_BLURB = {
  id: {
    type: 'string',
    description: '插件 id：小写字母开头，仅 [a-z0-9-]，最长 41。',
  },
  name: { type: 'string', description: '商店卡片标题' },
  blurb: {
    type: 'string',
    description:
      '给后续 Agent 和用户看的说明书：插件做什么、怎么打开或调用（窗口 / 无头 / HTTP）、关键文件或 API、不要踩的坑。写两三句，不要只写四个字。',
  },
  tags: {
    type: 'array',
    items: { type: 'string' },
    description: '标签，如 game、tool。也可写成逗号分隔字符串。',
  },
  author: { type: 'string', description: '作者名' },
  authorUrl: { type: 'string', description: '作者主页 / 仓库链接' },
  headless: {
    type: 'boolean',
    description: '无头插件：有 web 也不弹窗口、不要操纵栏。true 时不要写 shell。',
  },
  shell: {
    type: 'object',
      description: '有窗口的 web 必填。无头插件不要传。运行窗口内容区像素，对应 manifest.shell。必须给 width 和 height。',
    properties: {
      width: { type: 'number', description: '内容区宽，必填' },
      height: { type: 'number', description: '内容区高，必填' },
      minWidth: { type: 'number' },
      minHeight: { type: 'number' },
      resizable: { type: 'boolean', description: 'false 则锁死尺寸，适合固定画布' },
    },
    required: ['width', 'height'],
  },
}

export const PLUGIN_CREATE_PROPERTIES = {
  ...ID_NAME_BLURB,
  hostJs: {
    type: 'string',
    description: 'host.ts 源码，编译成 .plugin/<id>/host.js。可与 webJs 二选一或都给。',
  },
  webJs: {
    type: 'string',
    description: 'web.tsx 源码，编译成 .plugin/<id>/web.js。可与 hostJs 二选一或都给。',
  },
}

export const PLUGIN_SANDBOX_PROPERTIES = {
  ...ID_NAME_BLURB,
  hostJs: {
    type: 'string',
    description: '可选。写入沙箱 host.ts 的起点，大逻辑请在沙箱目录里改。',
  },
  webJs: {
    type: 'string',
    description: '可选。写入沙箱 web.tsx 的起点。',
  },
}

export { HOST_ENTRIES, WEB_ENTRIES, requireDeclaredShell, declaredStoreShell }
