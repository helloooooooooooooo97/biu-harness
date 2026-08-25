import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from 'cordis'
import { ChannelService } from './index.ts'

test('channels sqlite: create channel, members, ordered message stream + cursor', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'channels-'))
  const path = join(dir, 'channels.sqlite')
  try {
    const ctx = new Context()
    const svc = new ChannelService(ctx, path).open()

    // 创建频道（owner 自动成为成员）
    const ch = svc.createChannel('运维组', 'Alice')
    assert.equal(ch.name, '运维组')
    assert.equal(ch.owner, 'Alice')
    assert.equal(svc.listMembers(ch.id).length, 1)
    assert.equal(svc.listMembers(ch.id)[0]?.role, 'owner')

    // 邀请加入
    const inv = svc.createInvite(ch.id, 'member', null, null)
    const joined = svc.redeemInvite(inv.id, 'host_bob', 'Bob')
    assert.equal(joined.id, ch.id)
    assert.equal(svc.isMember(ch.id, 'host_bob'), true)

    // 有序消息流
    const m1 = svc.postMessage(ch.id, 'Alice', 'text', { text: '大家好' })
    const m2 = svc.postMessage(ch.id, 'Bob', 'text', { text: '收到' })
    assert.ok(m1.seq < m2.seq)

    // 游标增量拉取：新成员从 0 拉，只拿到 2 条
    const pulled = svc.pullMessages(ch.id, 0)
    assert.equal(pulled.length, 2)
    assert.equal(pulled[0]?.sender, 'Alice')
    assert.equal(pulled[1]?.sender, 'Bob')

    // 增量：after=m1.seq 只拿到 m2
    const inc = svc.pullMessages(ch.id, m1.seq)
    assert.equal(inc.length, 1)
    assert.equal(inc[0]?.seq, m2.seq)

    // 游标推进后立即生效
    svc.advanceCursor(ch.id, 'host_bob', m2.seq)
    assert.equal(svc.listMembers(ch.id).find((m) => m.memberId === 'host_bob')?.cursorSeq, m2.seq)

    // 邀请过期
    const exp = svc.createInvite(ch.id, 'member', Date.now() - 1000, null)
    assert.throws(() => svc.redeemInvite(exp.id, 'host_carol', 'Carol'), /过期/)

    // 邀请次数上限
    const limited = svc.createInvite(ch.id, 'member', null, 1)
    svc.redeemInvite(limited.id, 'host_carol', 'Carol')
    assert.throws(() => svc.redeemInvite(limited.id, 'host_dave', 'Dave'), /使用上限/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
