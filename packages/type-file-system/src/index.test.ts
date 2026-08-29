import { test } from 'vitest'
import assert from 'node:assert/strict'
import { asImageSrc } from './index.ts'

test('asImageSrc keeps http, data:image, and same-origin image paths', () => {
  assert.equal(asImageSrc('https://example.com/a.png'), 'https://example.com/a.png')
  assert.equal(asImageSrc('data:image/svg+xml;base64,QQ=='), 'data:image/svg+xml;base64,QQ==')
  assert.equal(asImageSrc('/page-covers/red.png'), '/page-covers/red.png')
  assert.equal(asImageSrc('/covers/photo.webp?v=1'), '/covers/photo.webp?v=1')
  assert.equal(asImageSrc({ src: '/page-covers/blue.png' }), '/page-covers/blue.png')
})

test('asImageSrc rejects scripts and non-image paths', () => {
  assert.equal(asImageSrc('javascript:alert(1)'), '')
  assert.equal(asImageSrc('//evil.example/x.png'), '')
  assert.equal(asImageSrc('/not-an-image.txt'), '')
  assert.equal(asImageSrc('../secret.png'), '')
})
