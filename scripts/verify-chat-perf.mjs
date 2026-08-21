import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
const BASE = 'http://127.0.0.1:5173'
const CHROME = '/usr/bin/google-chrome-stable'
const SID = readFileSync('/tmp/heavy-session-id.txt','utf8').trim()

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

const t0 = Date.now()
await page.goto(`${BASE}/s/${SID}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForSelector('textarea[aria-label="对话输入"]', { timeout: 60000 })
await page.waitForFunction(() => document.querySelector('[data-chat-virtual]') != null, { timeout: 60000 })
const loadMs = Date.now() - t0

const dom = await page.evaluate(() => ({
  virtual: document.querySelector('[data-chat-virtual]')?.getAttribute('data-chat-virtual'),
  chatMd: document.querySelectorAll('.chat-md').length,
  virtualRows: document.querySelectorAll('[data-chat-virtual] [data-index]').length,
  bodyChars: (document.body.innerText||'').length,
}))

// typing latency on heavy page (no stream): keydown -> input value
const typing = []
const ta = await page.$('textarea[aria-label="对话输入"]')
await ta.click({ clickCount: 3 })
for (const ch of 'hello-perf-test-0123456789') {
  const dt = await page.evaluate(async (c) => {
    const el = document.querySelector('textarea[aria-label="对话输入"]')
    const t0 = performance.now()
    el.focus()
    el.value = (el.value || '') + c
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: c, inputType: 'insertText' }))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return performance.now() - t0
  }, ch)
  typing.push(dt)
}

// simulate chunk flood via page: hijack by calling into React is hard.
// Instead measure many rapid WS-like updates by evaluating store if exposed — not exposed.
// Proxy: inject many DOM-idle mainthread tasks? Skip.
// Use CDP to inject Performance marks while firing custom events on window for a test hook.
await page.evaluate(() => {
  window.__chunkProbe = []
})

// Flood sessionView through the same path the app uses: open WS and we can't forge signed events easily.
// Measure Trajectory switch cost on heavy chat (should stay fast with visibility+memo).
const switches = []
for (let i = 0; i < 5; i++) {
  const ms = await page.evaluate(async (id) => {
    const click = (href, text) => {
      const a = [...document.querySelectorAll('a')].find(el => el.getAttribute('href')===href && (el.textContent||'').includes(text))
      a?.click()
    }
    const t0 = performance.now()
    click(`/s/${id}/trajectory`, 'Trajectory')
    await new Promise((r, j) => {
      const start = performance.now()
      const tick = () => {
        if (location.pathname.endsWith('/trajectory')) return r()
        if (performance.now()-start > 8000) return j(new Error('timeout traj'))
        requestAnimationFrame(tick)
      }
      tick()
    })
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const mid = performance.now()
    click(`/s/${id}`, 'Chat')
    await new Promise((r, j) => {
      const start = performance.now()
      const tick = () => {
        if (location.pathname === `/s/${id}` || location.pathname === `/s/${id}/chat`) return r()
        if (performance.now()-start > 8000) return j(new Error('timeout chat'))
        requestAnimationFrame(tick)
      }
      tick()
    })
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    return { toTraj: mid - t0, toChat: performance.now() - mid }
  }, SID)
  switches.push(ms)
}

const med = (xs) => { const a=[...xs].sort((x,y)=>x-y); const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2 }

const report = {
  sessionId: SID,
  load_ms: loadMs,
  dom,
  typing_input_to_raf2_ms: {
    median: Math.round(med(typing)),
    max: Math.round(Math.max(...typing)),
    samples: typing.map(n => Math.round(n)),
  },
  chat_traj_switch_ms: {
    toTraj_median: Math.round(med(switches.map(s => s.toTraj))),
    toChat_median: Math.round(med(switches.map(s => s.toChat))),
  },
}
console.log(JSON.stringify(report, null, 2))
await browser.close()
