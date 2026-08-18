/**
 * mini-dsh web surface 的浏览器 fiber（client bundle）。
 *
 * 契约：mount() / dispose()，加上始终在线的 /hmr receiver（对应 dsh 的
 * "reload receiver is always on"）。收到 reload 事件 →
 * dispose 旧 fiber → import('/client.js?v=' + version) 破缓存加载新 bundle。
 * 新模块实例自带 mount()，于是"前端自己更新自己"。
 */

let receiver

export function mount() {
  const el = document.getElementById('app')
  if (el) el.textContent = 'browser fiber alive — HMR receiver always on'
}

export function dispose() {
  if (receiver) receiver.close()
  const el = document.getElementById('app')
  if (el) el.textContent = ''
}

receiver = new EventSource('/hmr')
receiver.onmessage = async (event) => {
  const data = JSON.parse(event.data)
  if (data.type !== 'reload') return
  dispose()
  await import(`/client.js?v=${data.version}`)
}

mount()
