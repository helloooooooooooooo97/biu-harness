import { test } from 'vitest'
import assert from 'node:assert/strict'
import * as lu from '@heroicons/react/16/solid'
import { pickKindIcon } from './chip.tsx'

test('kind maps to distinct heroicons', () => {
  const needed = [
    'CpuChipIcon',
    'CircleStackIcon',
    'StopCircleIcon',
    'HashtagIcon',
    'Square3Stack3DIcon',
    'RectangleStackIcon',
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
  assert.equal(pickKindIcon('session'), lu.CpuChipIcon)
  assert.equal(pickKindIcon('message'), lu.ChatBubbleLeftIcon)
  assert.notEqual(pickKindIcon('session'), pickKindIcon('message'))
  assert.equal(pickKindIcon('task'), lu.ClipboardDocumentCheckIcon)
  assert.equal(pickKindIcon('page'), lu.DocumentIcon)
  assert.notEqual(pickKindIcon('collection'), pickKindIcon('usage'))
  assert.equal(pickKindIcon('plugin'), lu.PuzzlePieceIcon)
  assert.equal(pickKindIcon('unknown'), lu.TagIcon)
})
