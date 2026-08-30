import { test } from 'vitest'
import assert from 'node:assert/strict'
import * as lu from '@heroicons/react/16/solid'
import { pickKindIcon } from './chip.tsx'

test('chip icons exist on @heroicons/react/16/solid', () => {
  const needed = [
    'CpuChipIcon',
    'CircleStackIcon',
    'StopCircleIcon',
    'HashtagIcon',
    'Square3Stack3DIcon',
    'ClipboardDocumentCheckIcon',
    'ChatBubbleLeftIcon',
    'PuzzlePieceIcon',
    'TagIcon',
    'WrenchScrewdriverIcon',
    'DocumentIcon',
  ] as const
  for (const name of needed) {
    assert.ok(name in lu, `${name} missing`)
  }
  assert.ok(pickKindIcon('event'))
  assert.ok(pickKindIcon('usage'))
  assert.ok(pickKindIcon('session'))
})
