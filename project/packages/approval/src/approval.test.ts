import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApprovalGate, decide, policyFor } from './index.ts'

// 本文件测 approval：fail-closed、预设矩阵、decide 集成。

test('没有 resolver 时缺省拒绝', async () => {
  assert.equal(await new ApprovalGate().ask('允许？'), false)
})

test('权限预设裁决矩阵', () => {
  assert.equal(policyFor('read-only', { name: 'r', kind: 'read' }), 'allow')
  assert.equal(policyFor('read-only', { name: 'b', kind: 'exec' }), 'deny')
  assert.equal(policyFor('workspace-write', { name: 'b', kind: 'exec' }), 'ask')
  assert.equal(policyFor('full', { name: 'b', kind: 'exec' }), 'allow')
})

test('decide：ask 走审批，拒绝即 false', async () => {
  const deny = new ApprovalGate(async () => false)
  assert.equal(await decide('workspace-write', { name: 'bash', kind: 'exec' }, deny), false)
  const allow = new ApprovalGate(async () => true)
  assert.equal(await decide('workspace-write', { name: 'bash', kind: 'exec' }, allow), true)
})
