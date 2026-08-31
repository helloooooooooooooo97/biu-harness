import { describe, expect, it } from 'vitest'
import { Context } from 'cordis'
import { DockService } from './service.ts'

function dock() {
  return new DockService(new Context())
}

describe('DockService', () => {
  it('keeps pinned apps on the left and running plugins after the separator', () => {
    const svc = dock()
    svc.register({ id: 'composer', title: 'Composer', order: 30, kind: 'composer' })
    svc.register({ id: 'session', title: 'Session', order: 10, kind: 'session' })
    svc.register({ id: 'pick', title: '选取', order: 20, kind: 'tool' })
    svc.register({ id: 'plugin:notes', title: 'Notes', group: 'running', kind: 'plugin', pinned: false })
    expect(svc.list().map((app) => app.id)).toEqual(['session', 'pick', 'composer', 'plugin:notes'])
  })

  it('open focuses an app and close keeps pinned tiles', () => {
    const svc = dock()
    let opened = 0
    let closed = 0
    svc.register({
      id: 'composer',
      title: 'Composer',
      kind: 'composer',
      onOpen: () => {
        opened += 1
      },
      onClose: () => {
        closed += 1
      },
    })
    svc.open('composer')
    expect(svc.list()[0]?.running).toBe(true)
    expect(svc.list()[0]?.focused).toBe(true)
    expect(opened).toBe(1)
    svc.close('composer')
    expect(svc.list()).toHaveLength(1)
    expect(svc.list()[0]?.running).toBe(false)
    expect(closed).toBe(1)
  })

  it('close removes unpinned plugin tiles', () => {
    const svc = dock()
    svc.register({ id: 'plugin:x', title: 'X', pinned: false, group: 'running', kind: 'plugin' })
    svc.close('plugin:x')
    expect(svc.list()).toEqual([])
  })
})
