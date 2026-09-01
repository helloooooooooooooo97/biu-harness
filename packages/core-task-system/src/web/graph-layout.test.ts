import { test } from 'vitest'
import assert from 'node:assert/strict'
import { asIdList, layoutTaskGraph } from './graph-layout.ts'

test('layoutTaskGraph layers dependents after their dependsOn', () => {
  const { nodes, edges } = layoutTaskGraph([
    { id: 'a', title: 'A', status: 'done' },
    { id: 'b', title: 'B', status: 'todo', dependsOn: ['a'] },
    { id: 'c', title: 'C', status: 'todo', dependsOn: ['b'] },
  ])
  assert.deepEqual(
    edges.map((edge) => `${edge.source}->${edge.target}`),
    ['a->b', 'b->c'],
  )
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]))
  assert.ok((byId.a?.x ?? 1) < (byId.b?.x ?? 0))
  assert.ok((byId.b?.x ?? 1) < (byId.c?.x ?? 0))
})

test('asIdList reads arrays and json strings', () => {
  assert.deepEqual(asIdList(['a', 'a', 'b']), ['a', 'b'])
  assert.deepEqual(asIdList('["x","y"]'), ['x', 'y'])
  assert.deepEqual(asIdList('p, q'), ['p', 'q'])
})
