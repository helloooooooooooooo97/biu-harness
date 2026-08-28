import { test } from 'vitest'
import assert from 'node:assert/strict'
import { posixShellArgv, posixShellBin, hostShellKind, describeHostRuntime } from './posix-shell.ts'

test('unix uses /bin/sh -c', () => {
  assert.equal(posixShellBin('darwin'), '/bin/sh')
  assert.deepEqual(posixShellArgv('echo hi', 'linux'), ['/bin/sh', '-c', 'echo hi'])
  assert.equal(hostShellKind('darwin'), 'sh')
  assert.match(describeHostRuntime('darwin'), /macOS/)
})

test('windows without git bash uses cmd /c', () => {
  const env = { ComSpec: 'C:\\Windows\\System32\\cmd.exe' }
  assert.equal(posixShellBin('win32', env), 'C:\\Windows\\System32\\cmd.exe')
  assert.deepEqual(posixShellArgv('echo hi', 'win32', env), [
    'C:\\Windows\\System32\\cmd.exe',
    '/d',
    '/s',
    '/c',
    'echo hi',
  ])
  assert.equal(hostShellKind('win32', env), 'cmd')
  assert.match(describeHostRuntime('win32', env), /cmd\.exe/)
})
