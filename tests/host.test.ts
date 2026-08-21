/**
 * Host-half smoke test: `apply` registers the editable settings namespace
 * (via `installSettingsSection`) and the Remote service reads the live
 * settings-resolved config through the source thunk.
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/index'

interface FakeScope {
  get: () => { refreshIntervalMs: number }
  set: (field: string, value: unknown) => Promise<void>
}

async function bench() {
  const ctx = new Context()
  const registrations: Array<{ ns: string; schema: unknown; base: unknown }> = []
  let scopeValue: { refreshIntervalMs: number } = { refreshIntervalMs: 30_000 }

  class FakeSettingsService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'settings')
    }

    register(ns: string, schema: unknown, options: { base: unknown }) {
      registrations.push({ ns, schema, base: options.base })
      return {
        get: () => scopeValue,
        set: async (field: string, value: unknown) => {
          if (field === 'refreshIntervalMs') scopeValue = { refreshIntervalMs: Number(value) }
        },
        watch: () => () => {},
      } as unknown as FakeScope
    }
  }
  new FakeSettingsService(ctx)

  class FakeToolsService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'tools')
    }

    register() {}
  }
  new FakeToolsService(ctx)

  apply(ctx, { refreshIntervalMs: 30_000 })
  // installSettingsSection runs through ctx.inject, which settles on a tick.
  await new Promise(resolve => setTimeout(resolve, 0))

  return { ctx, registrations, setScopeValue: (v: { refreshIntervalMs: number }) => { scopeValue = v } }
}

describe('git-status host plugin', () => {
  it('registers the settings namespace with the composition entry as base', async () => {
    const b = await bench()
    expect(b.registrations).toHaveLength(1)
    expect(b.registrations[0]?.ns).toBe('dsh-plugin-git-status')
    expect(b.registrations[0]?.base).toEqual({ refreshIntervalMs: 30_000 })
  })

  it('getPollConfig reads the live settings-resolved config', async () => {
    const b = await bench()
    const service = b.ctx.get('gitStatus') as { getPollConfig: () => Promise<{ refreshIntervalMs: number }> }
    expect(await service.getPollConfig()).toEqual({ refreshIntervalMs: 30_000 })

    b.setScopeValue({ refreshIntervalMs: 120_000 })
    // The source thunk reads the settings scope at call time.
    expect(await service.getPollConfig()).toEqual({ refreshIntervalMs: 120_000 })
  })
})
