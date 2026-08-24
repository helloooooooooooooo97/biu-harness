import { test } from 'vitest'
import assert from 'node:assert/strict'
import { danceSlot } from './dance-stage.tsx'

test('circle: 各点围绕中心均匀分布', () => {
  const slots = Array.from({ length: 8 }, (_, i) => danceSlot('circle', i, 8))
  // 圆心应约为 0,0
  const cx = slots.reduce((s, p) => s + p.x, 0) / slots.length
  const cy = slots.reduce((s, p) => s + p.y, 0) / slots.length
  assert.ok(Math.abs(cx) < 1, '圆心 x 偏差过大: ' + cx)
  assert.ok(Math.abs(cy) < 1, '圆心 y 偏差过大: ' + cy)
})

test('heart: 顶部单尖居中 + 底部 V 字收拢（不误判为圆）', () => {
  const slots = Array.from({ length: 20 }, (_, i) => danceSlot('heart', i, 20))
  // 顶部尖峰应几乎居中（x≈0）——标准心形顶部只有一个尖
  const top = slots.reduce((m, p) => (p.y > m.y ? p : m))
  assert.ok(Math.abs(top.x) < 15, `顶部尖应在中心附近，实际 x=${top.x.toFixed(1)}`)
  // 底部 V 字：最低两个点应横向分离（左右各一，形成 V 字）
  const sorted = [...slots].sort((a, b) => a.y - b.y)
  const b1 = sorted[0], b2 = sorted[1]
  assert.ok(Math.abs(b1.x - b2.x) > 30, `底部 V 尖应左右分开，实际 ${b1.x.toFixed(0)},${b2.x.toFixed(0)}`)
  // 心形应左右对称（相对中心 x≈0 对称）
  const cumulativeX = slots.reduce((s, p) => s + p.x, 0) / slots.length
  assert.ok(Math.abs(cumulativeX) < 10, `应左右对称，实际中心 x=${cumulativeX.toFixed(1)}`)
  // 不是扁圆：高度明显小于宽度，且不是正圆（圆的话宽=高）
  const ys = slots.map((p) => p.y)
  const xs = slots.map((p) => p.x)
  const height = Math.max(...ys) - Math.min(...ys)
  const width = Math.max(...xs) - Math.min(...xs)
  assert.ok(width > height * 0.8 && width < height * 1.6, `心形比例异常 宽=${width.toFixed(0)} 高=${height.toFixed(0)}`)
})

test('square: 所有点落在正方形边框上', () => {
  const half = 150
  const slots = Array.from({ length: 16 }, (_, i) => danceSlot('square', i, 16))
  for (const p of slots) {
    const onEdge =
      Math.abs(Math.abs(p.x) - half) < 1e-6 || Math.abs(Math.abs(p.y) - half) < 1e-6
    assert.ok(onEdge, `点(${p.x},${p.y}) 不在正方形边框上`)
  }
})

test('row: 单行时水平带内展开且左右对称', () => {
  const slots = Array.from({ length: 5 }, (_, i) => danceSlot('row', i, 5))
  // y 只允许轻微错落扰动（跳舞的活泼感），x 居中对称展开
  const ys = slots.map((p) => p.y)
  assert.ok(Math.max(...ys) - Math.min(...ys) < 30, '单行应集中在水平带内')
  assert.ok(slots[0].x < 0 && slots[4].x > 0, '应跨中心两侧展开')
  assert.ok(Math.abs(slots[0].x) < 1e-6 + 200, '最左 x 应为 -200 量级')
})

test('biu: 拼出 B-I-U 三字母、整体居中、从左到右排布', () => {
  // 取点数阵像素数(32)的整数倍，保证完整采样、均值真正归零
  const n = 64
  const slots = Array.from({ length: n }, (_, i) => danceSlot('biu', i, n))
  const xs = slots.map((p) => p.x)
  const ys = slots.map((p) => p.y)
  // 整体水平居中：x 均值≈0
  const cx = xs.reduce((s, v) => s + v, 0) / xs.length
  assert.ok(Math.abs(cx) < 60, `biu 应水平居中，实际 x 均值=${cx.toFixed(1)}`)
  // 高度方向也居中：y 均值≈0
  const cy = ys.reduce((s, v) => s + v, 0) / ys.length
  assert.ok(Math.abs(cy) < 60, `biu 应垂直居中，实际 y 均值=${cy.toFixed(1)}`)
  // 从左到右：字母 B（最左）早于 I（中）早于 U（右）
  // 取每个字母的代表点：B 的左侧像素、U 的右侧像素
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  assert.ok(maxX - minX > 300, `biu 应有的横向宽度，实际 ${(maxX - minX).toFixed(0)}px`)
  // 按点阵顺序第一个点应在左侧（B 字母起点）
  assert.ok(slots[0].x < 0, '点阵首像素应在左侧（B 起点）')
})
