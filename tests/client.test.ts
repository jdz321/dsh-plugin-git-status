/**
 * Browser-half smoke test on a real Cordis Context: the plugin mounts the
 * `gitStatus` Remote namespace through a provider child plugin, then a
 * consumer child plugin (which injects `remote.gitStatus`) registers the
 * `conversation.input.right` entry. This is the regression test for the
 * "cannot get property remote.gitStatus without inject" failure.
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index'
import type { GitStatusSnapshot } from '../src/types'

// The real component pulls in the browser UI-primitives bundle (with CSS);
// the apply-time behavior under test only needs the registration to carry a
// component value, so stub it.
vi.mock('../src/client/GitStatusBar', () => ({ GitStatusBar: () => null }))

function makeSnapshot(): GitStatusSnapshot {
  return {
    repo: '/repo',
    isRepo: true,
    branch: 'main',
    ahead: 0,
    behind: 0,
    clean: true,
    changeCount: 0,
    counts: { conflicted: 0, staged: 0, unstaged: 0, untracked: 0 },
    groups: { conflicted: [], staged: [], unstaged: [], untracked: [] },
  }
}

interface StoredEntry {
  options: { id?: string; order?: number; name?: string }
  locale?: string
  inject?: (sessionId: string) => Record<string, unknown>
  component: unknown
}

async function bench() {
  const ctx = new Context()
  const calls: Array<string | undefined> = []
  const stored = new Map<string, StoredEntry[]>()

  // Minimal `slots` face: registration runs immediately.
  ctx.provide('slots', {
    inject: (_key: string, callback: () => void) => { callback() },
    register: (options: { name: string; id?: string; order?: number; locale?: string; inject?: (sessionId: string) => Record<string, unknown> }, component: unknown) => {
      const list = stored.get(options.name) ?? []
      list.push({ options, locale: options.locale, inject: options.inject, component })
      stored.set(options.name, list)
    },
    entries: (key: string) => stored.get(key) ?? [],
  })

  ctx.provide('locale', { register: () => () => {} })

  // Minimal `remote` face whose `$mount` provides `remote.gitStatus`, mirroring
  // the real Gateway ClientRemoteService.
  class FakeRemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }

    async $mount(_contribution: unknown): Promise<() => Promise<void>> {
      this.ctx.provide('remote.gitStatus', {
        status: (cwd?: string) => {
          calls.push(cwd)
          return Promise.resolve({ ok: true as const, value: makeSnapshot() })
        },
      })
      return async () => {}
    }
  }
  new FakeRemoteService(ctx)

  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()

  return {
    ctx,
    fiber,
    calls,
    entry: () => stored.get('conversation.input.right')?.[0],
  }
}

describe('git-status browser plugin', () => {
  it('registers the composer tool-row entry after mounting the remote namespace', async () => {
    const b = await bench()
    expect(b.entry()).toBeDefined()
    expect(b.entry()?.options).toMatchObject({ id: 'git-status', order: 0 })
    expect(b.entry()?.locale).toBe('git-status')
  })

  it('routes the injected status verb to the mounted remote namespace', async () => {
    const b = await bench()
    const entry = b.entry()
    expect(entry).toBeDefined()
    const injected = entry!.inject!('session-1')
    const { status } = injected as { status: (cwd?: string) => Promise<unknown> }
    const result = await status('/some/cwd')
    expect(result).toEqual({ ok: true, value: makeSnapshot() })
    expect(b.calls).toEqual(['/some/cwd'])
  })
})
