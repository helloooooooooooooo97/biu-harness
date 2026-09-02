import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as lu from '@heroicons/react/16/solid'
import { tagTone } from '@biu/public-ui'
import { pickKindIcon, pickKindTone } from './chip.tsx'

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

test('pick kind maps to the SuperTag palette by string', () => {
  assert.equal(pickKindTone('session'), tagTone('session'))
  assert.equal(pickKindTone('task'), tagTone('task'))
  assert.notEqual(pickKindTone('session'), pickKindTone('task'))
})

test('pick chips can show the SuperTag close mark', () => {
  const src = readFileSync(resolve(import.meta.dirname, './chip.tsx'), 'utf8')
  assert.match(src, /onRemove/)
  assert.match(src, /biu-tag-x/)
  assert.match(src, /TagChipCloseMark/)
})
