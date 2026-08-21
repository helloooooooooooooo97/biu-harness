/**
 * Ad-hoc frontend route latency probe (not a repo skill / CI suite).
 * Measures click → URL + paint-ish readiness for Chat/Trajectory/Workspace.
 */
import puppeteer from 'puppeteer-core'

const BASE = process.env.APP_BASE || 'http://127.0.0.1:5173'
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
const RUNS = Number(process.env.RUNS || 5)

function median(xs) {
  const a = [...xs].sort((x, y) => x - y)
  const mid = Math.floor(a.length / 2)
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

function stats(label, samples) {
  const min = Math.min(...samples)
  const max = Math.max(...samples)
  const avg = samples.reduce((s, n) => s + n, 0) / samples.length
  return {
    label,
    n: samples.length,
    min_ms: Math.round(min),
    median_ms: Math.round(median(samples)),
    avg_ms: Math.round(avg),
    max_ms: Math.round(max),
    samples_ms: samples.map((n) => Math.round(n)),
  }
}

async function pickHeavySession(page) {
  const sessions = await page.evaluate(async () => {
    const res = await fetch('/api/sessions')
    const body = await res.json()
    return body.sessions || []
  })
  if (!sessions.length) throw new Error('no sessions')
  sessions.sort((a, b) => (b.eventCount || 0) - (a.eventCount || 0))
  return sessions[0]
}

async function waitPath(page, predicate, timeout = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const path = await page.evaluate(() => location.pathname)
    if (predicate(path)) return path
    await new Promise((r) => setTimeout(r, 16))
  }
  throw new Error(`timeout waiting path; got ${await page.evaluate(() => location.pathname)}`)
}

async function measureClick(page, click, expectPath) {
  // Force layout flush before click so timing starts from interaction.
  await page.evaluate(() => document.body.getBoundingClientRect())
  const t0 = await page.evaluate(() => performance.now())
  await click()
  await waitPath(page, expectPath)
  // Double-rAF ≈ next paint after React commit
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )
  const t1 = await page.evaluate(() => performance.now())
  return t1 - t0
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 })

  const heavy = await pickHeavySession(page)
  const sessionUrl = `${BASE}/s/${heavy.id}`
  await page.goto(sessionUrl, { waitUntil: 'networkidle2', timeout: 60000 })
  // Wait shell ready
  await page.waitForSelector('a[aria-label="Agent"], a[title="Agent"], .app-activity-bar', { timeout: 15000 })
  await page.waitForFunction(() => document.body.innerText.includes('Chat') && document.body.innerText.includes('Trajectory'), {
    timeout: 15000,
  })

  const chatToTraj = []
  const trajToChat = []
  const agentToWs = []
  const wsToAgent = []

  for (let i = 0; i < RUNS; i++) {
    // ensure chat
    if (!(await page.evaluate(() => /\/trajectory$/.test(location.pathname) === false && location.pathname.includes('/s/')))) {
      await page.click('a[href$="/' + heavy.id + '"], header a')
    }
    // Click Trajectory nav — prefer exact href
    chatToTraj.push(
      await measureClick(
        page,
        async () => {
          const sel = `a[href="/s/${heavy.id}/trajectory"]`
          await page.waitForSelector(sel, { timeout: 5000 })
          await page.click(sel)
        },
        (p) => p.endsWith('/trajectory'),
      ),
    )
    trajToChat.push(
      await measureClick(
        page,
        async () => {
          const sel = `a[href="/s/${heavy.id}"]`
          await page.waitForSelector(sel, { timeout: 5000 })
          // NavLink Chat uses end — there may be multiple; pick header one
          const handles = await page.$$(sel)
          let clicked = false
          for (const h of handles) {
            const text = await page.evaluate((el) => el.textContent || '', h)
            if (text.includes('Chat')) {
              await h.click()
              clicked = true
              break
            }
          }
          if (!clicked) await page.click(sel)
        },
        (p) => p === `/s/${heavy.id}` || p === `/s/${heavy.id}/chat`,
      ),
    )
  }

  for (let i = 0; i < RUNS; i++) {
    agentToWs.push(
      await measureClick(
        page,
        async () => {
          await page.click('a[href="/workspace"]')
        },
        (p) => p === '/workspace' || p.startsWith('/workspace'),
      ),
    )
    wsToAgent.push(
      await measureClick(
        page,
        async () => {
          // activity bar Agent link
          const sel = `a[href="/s/${heavy.id}"], a[href="/s/${heavy.id}/trajectory"], a.app-activity-item[href="/"]`
          const agent = await page.$('a[aria-label="Agent"]')
          if (agent) await agent.click()
          else {
            // fallback brand/home or first activity item after brand
            const items = await page.$$('.app-activity-list a')
            if (items[0]) await items[0].click()
            else await page.click(sel)
          }
        },
        (p) => p === '/' || p.startsWith('/s/'),
      ),
    )
  }

  // Long task / commit probe while on trajectory with heavy session
  await page.goto(`${sessionUrl}/trajectory`, { waitUntil: 'networkidle2', timeout: 60000 })
  const trajRows = await page.evaluate(() => document.querySelectorAll('[id^="traj-"], .traj-row, table tr').length)
  const longTasks = await page.evaluate(() => {
    return new Promise((resolve) => {
      const observed = []
      try {
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) observed.push({ name: e.name, duration: e.duration })
        })
        obs.observe({ entryTypes: ['longtask', 'measure'] })
        // force a view toggle via history + click
        const chat = [...document.querySelectorAll('a')].find((a) => (a.textContent || '').includes('Chat'))
        const t0 = performance.now()
        chat?.click()
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const dt = performance.now() - t0
            obs.disconnect()
            resolve({ clickToRaf2_ms: dt, longTasks: observed.slice(0, 20) })
          })
        })
      } catch (error) {
        resolve({ error: String(error), longTasks: observed })
      }
    })
  })

  const report = {
    base: BASE,
    session: { id: heavy.id, title: heavy.title, eventCount: heavy.eventCount },
    trajDomHintRows: trajRows,
    metrics: [
      stats('chat → trajectory', chatToTraj),
      stats('trajectory → chat', trajToChat),
      stats('agent → workspace', agentToWs),
      stats('workspace → agent', wsToAgent),
    ],
    extra: longTasks,
  }

  console.log(JSON.stringify(report, null, 2))
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
