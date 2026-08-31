import { describe, expect, it } from 'vitest'
import { Context } from 'cordis'
import { DockService } from './service.ts'

function dock() {
  return new DockService(new Context())
}

describe('DockService', () => {
  it('orders dock as places, tools, then tray', () => {
    const svc = dock()
    svc.register({ id: 'composer', title: 'Composer', kind: 'composer' })
    svc.register({ id: 'session', title: 'Session', kind: 'session' })
    svc.register({ id: 'pick', title: '选取', kind: 'tool' })
    svc.register({ id: 'settings', title: 'Settings', kind: 'tool', group: 'tray' })
    svc.register({ id: 'plugin:notes', title: 'Notes', group: 'tray', kind: 'plugin', pinned: false })
    expect(svc.list().map((app) => app.id)).toEqual(['session', 'composer', 'pick', 'settings', 'plugin:notes'])
    expect(svc.list().map((app) => app.group)).toEqual(['places', 'tools', 'tools', 'tray', 'tray'])
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
    svc.register({ id: 'plugin:x', title: 'X', pinned: false, group: 'tray', kind: 'plugin' })
    svc.close('plugin:x')
    expect(svc.list()).toEqual([])
  })

  it('hides tiles with visible false', () => {
    const svc = dock()
    svc.register({ id: 'composer', title: 'Composer', kind: 'composer' })
    svc.register({ id: 'pick', title: '选取', kind: 'tool' })
    expect(svc.list().map((app) => app.id)).toEqual(['composer', 'pick'])
    svc.patch('composer', { visible: false })
    svc.patch('pick', { visible: false })
    expect(svc.list()).toEqual([])
  })

  it('module tiles keep onOpen without marking running', () => {
    const svc = dock()
    let opened = 0
    svc.register({
      id: 'module:agent',
      title: 'Agent',
      kind: 'module',
      Icon: () => null,
      onOpen: () => {
        opened += 1
      },
    })
    expect(svc.list()[0]?.kind).toBe('module')
    expect(svc.list()[0]?.running).toBe(false)
    svc.list()[0]?.onOpen?.()
    expect(opened).toBe(1)
    expect(svc.list()[0]?.running).toBe(false)
  })
})
