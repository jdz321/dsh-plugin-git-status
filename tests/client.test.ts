/**
 * Browser-half smoke test on a real Cordis Context: the plugin mounts the
 * `gitStatus` Remote namespace through a provider child plugin, a consumer
 * child plugin (which injects `remote.gitStatus`) registers the
 * `conversation.input.right` entry, and a third child registers the settings
 * page into `plugins.bundle.config` — but only while the Host serves this
 * plugin's settings entry. This is the regression test for the
 * "cannot get property remote.gitStatus without inject" failure and for the
 * 0.2.0-rc.2 `settingsScope` → `configForms` migration.
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { GitStatusSnapshot, PollConfig } from '../src/types'
import { SETTINGS_ENTRY_ID } from '../src/client/settings-entry'
import { apply, inject } from '../src/client/index'

// The real components pull in the browser UI-primitives bundle (whose built
// entry imports CSS); apply-time behavior only needs the registration to carry
// a component value, so stub them.
vi.mock('../src/client/GitStatusBar', () => ({ GitStatusBar: () => null }))
vi.mock('../src/client/PluginConfigCard', () => ({
  GitStatusSettingsCard: () => null,
  GitStatusSettingsCardController: class {
    disposed = false
    inject() { return { hooks: { gitStatusCard: { getSnapshot: () => undefined, subscribe: () => () => {} } }, edit: () => {}, resetField: () => {}, save: () => {}, discard: () => {} } }
    dispose() { this.disposed = true }
  },
}))

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
  options: {
    name: string
    id?: string
    key?: string
    order?: number
    locale?: string
    inject?: (...args: unknown[]) => Record<string, unknown>
  }
  component: unknown
}

/** The accepted-value mirror the shared configuration form publishes through. */
class FakeConfigForm<T extends Record<string, unknown>> {
  private snapshot: { status: 'ready' | 'unavailable'; value: T | undefined; revision: number | undefined }
  private readonly listeners = new Set<() => void>()

  constructor(value: T | undefined) {
    this.snapshot = value === undefined
      ? { status: 'unavailable', value: undefined, revision: undefined }
      : { status: 'ready', value, revision: 1 }
  }

  getSnapshot() { return this.snapshot }
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  async mutate() { return true }
  async set() { return true }
  async unset() { return true }

  /** Stand in for a settings save the Host accepted. */
  commit(value: T): void {
    this.snapshot = { status: 'ready', value, revision: (this.snapshot.revision ?? 0) + 1 }
    for (const listener of this.listeners) listener()
  }
}

async function bench(options: { served: boolean }) {
  const ctx = new Context()
  const calls: Array<string | undefined> = []
  const stored = new Map<string, StoredEntry[]>()

  const register = (options_: StoredEntry['options'], component: unknown): (() => void) => {
    const entry: StoredEntry = { options: options_, component }
    const list = stored.get(options_.name) ?? []
    list.push(entry)
    stored.set(options_.name, list)
    return () => {
      const current = stored.get(options_.name) ?? []
      stored.set(options_.name, current.filter(candidate => candidate !== entry))
    }
  }

  const injectFaces = new Map<string, unknown>()
  ctx.provide('slots', {
    inject: (key: string, callback: () => (() => void) | void) => {
      const off = callback()
      injectFaces.set(key, off)
      return off ?? (() => {})
    },
    register: (options_: StoredEntry['options'], component: unknown) => register(options_, component),
    entries: (key: string) => stored.get(key) ?? [],
  })

  ctx.provide('locale', {
    register: () => () => {},
    bind: () => (key: string) => key,
    getSnapshot: () => ({ revision: 0 }),
    subscribe: () => () => {},
  })

  const form = new FakeConfigForm<Record<string, unknown>>(
    options.served ? { refreshIntervalMs: 30_000 } : undefined,
  )
  ctx.provide('configForms', {
    get: () => form,
    whileServed: (namespaces: readonly string[], registerPage: (served: ReadonlySet<string>) => () => void) => {
      if (!options.served) return () => {}
      const off = registerPage(new Set(namespaces))
      return () => { off() }
    },
  })

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
        getPollConfig: () => Promise.resolve({ ok: true as const, value: { refreshIntervalMs: 30_000 } satisfies PollConfig }),
      })
      return async () => {}
    }
  }
  new FakeRemoteService(ctx)

  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  // Child fibers settle on later ticks; the registrations land once every
  // injected service they wait on exists.
  for (let tick = 0; tick < 8; tick += 1) await new Promise(resolve => setTimeout(resolve, 0))

  return {
    ctx,
    fiber,
    form,
    calls,
    entry: () => stored.get('conversation.input.right')?.[0],
    settingsEntry: () => stored.get('plugins.bundle.config')?.[0],
  }
}

describe('git-status browser plugin', () => {
  it('registers the composer tool-row entry after mounting the remote namespace', async () => {
    const b = await bench({ served: true })
    expect(b.entry()).toBeDefined()
    expect(b.entry()?.options).toMatchObject({ id: 'git-status', order: 0 })
    expect(b.entry()?.options.locale).toBe('git-status')
  })

  it('routes the injected status verb to the mounted remote namespace', async () => {
    const b = await bench({ served: true })
    const injected = b.entry()?.options.inject?.('session-1') as { status: (cwd: string) => Promise<unknown> }
    const result = await injected.status('/some/cwd')
    expect(result).toEqual({ ok: true, value: makeSnapshot() })
    expect(b.calls).toEqual(['/some/cwd'])
  })

  it('registers the settings page on the bundle seat the Plugins page dispatches', async () => {
    const b = await bench({ served: true })
    expect(b.settingsEntry()?.options).toMatchObject({ key: 'dsh-plugin-git-status' })
    expect(b.settingsEntry()?.options.locale).toBe('git-status')
    expect(b.settingsEntry()?.options.id).toBeUndefined()
    expect(b.settingsEntry()?.component).toBeDefined()
  })

  it('exposes no settings page when the Host does not serve the entry', async () => {
    const b = await bench({ served: false })
    expect(b.entry()).toBeDefined()
    expect(b.settingsEntry()).toBeUndefined()
  })

  it('mirrors the accepted refresh interval, and the Remote value stands in when unserved', async () => {
    const served = await bench({ served: true })
    const servedWatch = (served.entry()?.options.inject?.() as { pollWatch: { getSnapshot: () => number | undefined; subscribe: (l: () => void) => () => void } }).pollWatch
    expect(servedWatch.getSnapshot()).toBe(30_000)

    let notified = 0
    const off = servedWatch.subscribe(() => { notified += 1 })
    served.form.commit({ refreshIntervalMs: 120_000 })
    expect(servedWatch.getSnapshot()).toBe(120_000)
    expect(notified).toBe(1)
    off()

    served.form.commit({ refreshIntervalMs: 120_000 })
    expect(notified).toBe(1)

    const unserved = await bench({ served: false })
    const unservedWatch = (unserved.entry()?.options.inject?.() as { pollWatch: { getSnapshot: () => number | undefined } }).pollWatch
    expect(unservedWatch.getSnapshot()).toBeUndefined()
  })
})
