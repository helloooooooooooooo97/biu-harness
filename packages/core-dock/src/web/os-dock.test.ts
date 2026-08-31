import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

test('os dock auto-hides behind a peek bar and opens on hover', () => {
  const src = readFileSync(resolve(import.meta.dirname, './os-dock.tsx'), 'utf8')
  const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')
  assert.match(src, /places.*tools.*tray/s)
  assert.match(src, /os-dock-peek/)
  assert.match(src, /os-dock-edge/)
  assert.match(src, /onPointerEnter=\{show\}/)
  assert.match(css, /\.os-dock\s*\{[^}]*left:\s*0/s)
  assert.match(css, /\.os-dock\s*\{[^}]*right:\s*0/s)
  assert.doesNotMatch(css, /\.os-dock \{[^}]*transform:\s*translateX\(-50%\)/s)
  assert.match(css, /\.os-dock-edge\s*\{[^}]*left:\s*0/s)
  assert.match(css, /\.os-dock-edge\s*\{[^}]*right:\s*0/s)
  assert.match(src, /is-open/)
  assert.match(src, /HIDE_MS/)
  assert.match(src, /pointerOver/)
  assert.match(src, /onPointerDown=\{show\}/)
  assert.match(src, /if \(pointerOver\.current\) return/)
  assert.match(css, /\.os-dock-peek\s*\{/)
  assert.match(css, /\.os-dock-shelf\s*\{[^}]*translateY\(calc\(100% \+ 20px\)\)/s)
  assert.match(css, /\.os-dock\.is-open \.os-dock-shelf\s*\{[^}]*translateY\(0\)/s)
  assert.match(css, /\.os-dock\.is-open \.os-dock-peek\s*\{[^}]*opacity:\s*0/s)
  assert.match(css, /\.os-dock-item:hover/)
  assert.match(css, /scale\(1\.18\)/)
  assert.match(css, /\.os-dock-shelf-row\s*\{[^}]*border-radius:\s*18px/s)
  assert.match(css, /\.os-dock-shelf-row\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.1\)/s)
  assert.match(css, /\.os-dock-tile\s*\{[^}]*width:\s*42px/s)
  assert.match(src, /os-dock-below/)
  assert.match(src, /innerHeight - 32/)
})
