import { test } from 'vitest'
import assert from 'node:assert/strict'
import * as lu from 'react-icons/lu'
import { pickKindIcon } from './chip.tsx'

test('chip icons exist on react-icons/lu (Vite ESM named exports)', () => {
  const needed = [
    'LuCoins',
    'LuGitCommitHorizontal',
    'LuHash',
    'LuLayers',
    'LuListTodo',
    'LuMessageSquare',
    'LuPuzzle',
    'LuTag',
    'LuWrench',
  ] as const
  for (const name of needed) {
    assert.equal(typeof (lu as Record<string, unknown>)[name], 'function', `${name} missing`)
  }
  assert.equal('LuGitCommit' in lu, false)
  assert.equal(typeof pickKindIcon('event'), 'function')
  assert.equal(typeof pickKindIcon('usage'), 'function')
})
