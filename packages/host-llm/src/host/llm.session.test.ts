import assert from 'node:assert/strict'
import { test } from 'vitest'
import { hasImageContent, DEEPSEEK_VISION_MODEL } from '@biu/host-llm'

test('hasImageContent detects image_url block in array content', () => {
  assert.equal(
    hasImageContent([
      { type: 'text' as const, text: 'hi' },
      { type: 'image_url' as const, image_url: { url: 'data:image/png;base64,xxx' } },
    ]),
    true,
  )
})

test('hasImageContent returns false for plain string / null / text-only', () => {
  assert.equal(hasImageContent('hello'), false)
  assert.equal(hasImageContent(null), false)
  assert.equal(hasImageContent(undefined), false)
  assert.equal(hasImageContent([{ type: 'text' as const, text: 'only text' }]), false)
})

test('DEEPSEEK_VISION_MODEL constant matches vision-exp model', () => {
  assert.equal(DEEPSEEK_VISION_MODEL, 'deepseek-v4-flash-vision-exp')
})
