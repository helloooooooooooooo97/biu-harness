import { useMemo } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { FsViewProps } from '@biu/type-file-system/ui'
import { layoutTaskGraph } from './graph-layout.ts'

function statusClass(status: string) {
  if (status === 'doing') return 'is-doing'
  if (status === 'done') return 'is-done'
  if (status === 'failed') return 'is-failed'
  return 'is-todo'
}

export function TaskDepGraph({ rows, onOpen }: FsViewProps) {
  const laid = useMemo(() => layoutTaskGraph(rows), [rows])
  const nodes: Node[] = useMemo(
    () =>
      laid.nodes.map((node) => ({
        id: node.id,
        position: { x: node.x, y: node.y },
        data: { label: node.title, status: node.status },
        className: `tasks-graph-node ${statusClass(node.status)}`,
      })),
    [laid],
  )
  const edges: Edge[] = useMemo(
    () =>
      laid.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })),
    [laid],
  )
  const onNodeClick: NodeMouseHandler = (_event, node) => {
    const row = rows.find((item) => item.id === node.id)
    if (row) onOpen(row)
  }
  if (!rows.length) return <p className="fsdb-empty">暂无记录</p>
  return (
    <div className="tasks-dep-graph" data-testid="tasks-dep-graph">
      <ReactFlow nodes={nodes} edges={edges} fitView onNodeClick={onNodeClick} proOptions={{ hideAttribution: true }}>
        <Background gap={18} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  )
}
