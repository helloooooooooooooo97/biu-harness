import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApprovalGate } from './approval.ts'
import { decide, policyFor, type PermissionPreset, type ToolAction } from './permission.ts'

// 本文件测权限预设：① 三档映射；② decide 集成；③ exec 走审批。

test('三个预设 × 三种动作的裁决矩阵', () => {
  const presets: PermissionPreset[] = ['read-only', 'workspace-write', 'full']
  const kinds: ToolAction['kind'][] = ['read', 'write', 'exec']
  const expected: Record<PermissionPreset, Record<ToolAction['kind'], string>> = {
    'read-only': { read: 'allow', write: 'deny', exec: 'deny' },
    'workspace-write': { read: 'allow', write: 'allow', exec: 'ask' },
    full: { read: 'allow', write: 'allow', exec: 'allow' },
  }
  for (const preset of presets) {
    for (const kind of kinds) {
      assert.equal(
        policyFor(preset, { name: 't', kind }),
        expected[preset][kind],
        `${preset}/${kind}`,
      )
    }
  }
})

test('decide：allow 放行、deny 拒绝、ask 走审批', async () => {
  const gate = new ApprovalGate(async () => true)
  assert.equal(await decide('read-only', { name: 'read_file', kind: 'read' }, gate), true)
  assert.equal(await decide('read-only', { name: 'bash', kind: 'exec' }, gate), false)
  // workspace-write 的 exec 走审批：resolver 允许 → 放行
  assert.equal(await decide('workspace-write', { name: 'bash', kind: 'exec' }, gate), true)
})

test('exec 审批被拒绝时 decide 返回 false', async () => {
  const gate = new ApprovalGate(async () => false)
  assert.equal(await decide('workspace-write', { name: 'bash', kind: 'exec' }, gate), false)
})
