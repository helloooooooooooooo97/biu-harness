/**
 * 演示用 client 构建 watcher：把 web/version.txt 的 vN 提升为 v(N+1)。
 *
 * 等价于 dsh 的 tsdown --watch 重写 client bundle：client-hmr 插件检测到
 * version 变化后经 SSE 推 reload，浏览器 fiber 先 dispose 再加载新 bundle。
 * 运行：node apps/cli/web/build.mjs（每跑一次 = 一次"构建"）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('.', import.meta.url))
const file = join(dir, 'version.txt')
const version = readFileSync(file, 'utf8').trim()
const n = Number(version.replace(/^v/, '')) || 0
const next = `v${n + 1}`
writeFileSync(file, `${next}\n`)
console.log(`client bundle rebuilt → ${next}（SSE reload 已推送）`)
