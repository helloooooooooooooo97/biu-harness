import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'

const BASE = process.env.APP_BASE || 'http://127.0.0.1:5173'
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
const SID = process.env.HEAVY_SESSION_ID || readFileSync('/tmp/heavy-session-id.txt', 'utf8').trim()

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const t0 = Date.now()
await page.goto(`${BASE}/s/${SID}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForFunction(
  () => document.querySelector('[data-chat-virtual]') != null || (document.body.innerText || '').includes('压测长文'),
  { timeout: 120000 },
)
// give measure a beat
await new Promise((r) => setTimeout(r, 500))
const report = await page.evaluate(() => {
  const root = document.querySelector('[data-chat-virtual]')
  const md = document.querySelectorAll('.chat-md').length
  const headings = document.querySelectorAll('h1,h2,h3').length
  const absRows = document.querySelectorAll('[data-chat-virtual] [data-index]').length
  return {
    virtualAttr: root?.getAttribute('data-chat-virtual'),
    chatMdMounted: md,
    headingsMounted: headings,
    virtualRowsMounted: absRows,
    bodyChars: (document.body.innerText || '').length,
  }
})
report.load_ms = Date.now() - t0
console.log(JSON.stringify(report, null, 2))
await browser.close()
