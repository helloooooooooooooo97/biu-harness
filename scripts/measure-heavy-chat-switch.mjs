/**
 * Measure Chat↔Trajectory when chat already has heavy markdown DOM.
 * Usage: HEAVY_SESSION_ID=... node scripts/measure-heavy-chat-switch.mjs
 */
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'

const BASE = process.env.APP_BASE || 'http://127.0.0.1:5173'
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
const RUNS = Number(process.env.RUNS || 7)
const SID =
  process.env.HEAVY_SESSION_ID ||
  readFileSync('/tmp/heavy-session-id.txt', 'utf8').trim()

function median(xs) {
  const a = [...xs].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}
function stats(label, samples) {
  return {
    label,
    n: samples.length,
    min_ms: Math.round(Math.min(...samples)),
    median_ms: Math.round(median(samples)),
    avg_ms: Math.round(samples.reduce((s, n) => s + n, 0) / samples.length),
    max_ms: Math.round(Math.max(...samples)),
    samples_ms: samples.map((n) => Math.round(n)),
  }
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  const tLoad0 = Date.now()
  await page.goto(`${BASE}/s/${SID}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  // Wait until lots of markdown actually painted
  await page.waitForFunction(
    () => {
      const text = document.body.innerText || ''
      const headings = document.querySelectorAll('h1,h2,h3').length
      const codes = document.querySelectorAll('pre, code').length
      return text.includes('压测长文') && headings >= 20 && codes >= 10
    },
    { timeout: 120000 },
  )
  const loadMs = Date.now() - tLoad0
  const dom = await page.evaluate(() => ({
    chars: (document.body.innerText || '').length,
    headings: document.querySelectorAll('h1,h2,h3').length,
    codes: document.querySelectorAll('pre,code').length,
    markdownRoots: document.querySelectorAll('.dsw-md, [class*="markdown"]').length,
  }))

  // Install longtask observer
  await page.evaluate(() => {
    window.__longtasks = []
    try {
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__longtasks.push({ name: e.name, duration: e.duration, start: e.startTime })
        }
      })
      obs.observe({ type: 'longtask', buffered: true })
      window.__ltObs = obs
    } catch {
      /* ignore */
    }
  })

  const toTraj = []
  const toChat = []
  const toTrajLong = []
  const toChatLong = []

  for (let i = 0; i < RUNS; i++) {
    // ensure on chat with content visible
    await page.evaluate((id) => {
      const a = [...document.querySelectorAll('a')].find(
        (el) => el.getAttribute('href') === `/s/${id}` && (el.textContent || '').includes('Chat'),
      )
      a?.click()
    }, SID)
    await page.waitForFunction((id) => location.pathname === `/s/${id}` || location.pathname === `/s/${id}/chat`, {
      timeout: 10000,
    }, SID)
    await page.waitForFunction(() => (document.body.innerText || '').includes('压测长文'), { timeout: 30000 })

    await page.evaluate(() => {
      window.__longtasks = []
    })
    const t0 = await page.evaluate(() => performance.now())
    await page.evaluate((id) => {
      const a = [...document.querySelectorAll('a')].find(
        (el) => el.getAttribute('href') === `/s/${id}/trajectory` && (el.textContent || '').includes('Trajectory'),
      )
      a?.click()
    }, SID)
    await page.waitForFunction((id) => location.pathname.endsWith('/trajectory'), { timeout: 15000 }, SID)
    // wait until trajectory UI marker
    await page.waitForFunction(
      () =>
        document.querySelector('[class*="traj"]') != null ||
        (document.body.innerText || '').includes('turn/') ||
        (document.body.innerText || '').includes('assistant/message'),
      { timeout: 30000 },
    )
    await page.evaluate(
      () =>
        new Promise((r) => {
          requestAnimationFrame(() => requestAnimationFrame(r))
        }),
    )
    const t1 = await page.evaluate(() => performance.now())
    toTraj.push(t1 - t0)
    toTrajLong.push(
      await page.evaluate(() => (window.__longtasks || []).reduce((s, e) => s + (e.duration || 0), 0)),
    )

    await page.evaluate(() => {
      window.__longtasks = []
    })
    const u0 = await page.evaluate(() => performance.now())
    await page.evaluate((id) => {
      const a = [...document.querySelectorAll('a')].find(
        (el) => el.getAttribute('href') === `/s/${id}` && (el.textContent || '').includes('Chat'),
      )
      a?.click()
    }, SID)
    await page.waitForFunction((id) => location.pathname === `/s/${id}` || location.pathname === `/s/${id}/chat`, {
      timeout: 15000,
    }, SID)
    await page.waitForFunction(() => (document.body.innerText || '').includes('压测长文'), { timeout: 60000 })
    await page.evaluate(
      () =>
        new Promise((r) => {
          requestAnimationFrame(() => requestAnimationFrame(r))
        }),
    )
    const u1 = await page.evaluate(() => performance.now())
    toChat.push(u1 - u0)
    toChatLong.push(
      await page.evaluate(() => (window.__longtasks || []).reduce((s, e) => s + (e.duration || 0), 0)),
    )
  }

  const report = {
    label: process.env.LABEL || 'current',
    sessionId: SID,
    firstLoadChat_ms: loadMs,
    dom,
    metrics: [stats('chat → trajectory (heavy md)', toTraj), stats('trajectory → chat (heavy md)', toChat)],
    longtask_sum_ms: {
      toTraj: toTrajLong.map((n) => Math.round(n)),
      toChat: toChatLong.map((n) => Math.round(n)),
    },
  }
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
