import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

test('trajectory detail falls back to the session event API', () => {
  const traj = readFileSync(resolve(import.meta.dirname, './trajectory.tsx'), 'utf8')
  assert.match(traj, /loadEventDetail\(sessionId, selectedSeq\)/)
  assert.match(traj, /sessionView\?\.loadOlderTrajectory/)
  assert.match(traj, /SessionViewService \| undefined/)
})
