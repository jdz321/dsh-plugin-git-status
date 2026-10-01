/**
 * Host-half smoke test: `apply` registers the `git_status` tool and the
 * `gitStatus` Remote service, and `getPollConfig` reads the volatile config
 * reference the Loader keeps committing into — a Settings write updates that
 * value in place, with no remount.
 */

import { Context } from '@deepseek-ai/cordis'
import type { Volatile } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply, SETTINGS_ENTRY_ID } from '../src/index'
import type { Config } from '../src/index'

interface RegisteredTool {
  name: string
  description: string
  parameters: unknown
  execute: (args: { cwd?: string }, exec: unknown) => Promise<unknown>
}

/** A stand-in for the Loader-committed volatile reference. */
function volatileOf(value: number): Volatile<number> & { commit: (next: number) => void } {
  let current = value
  return {
    get: () => current,
    commit: (next: number) => { current = next },
  }
}

function bench() {
  const ctx = new Context()
  const tools = new Map<string, RegisteredTool>()
  ctx.provide('tools', {
    register: (definition: RegisteredTool) => {
      tools.set(definition.name, definition)
      return () => { tools.delete(definition.name) }
    },
  })

  const refreshIntervalMs = volatileOf(30_000)
  // The composition entry the Loader resolves: every field arrives as a
  // reference, which is exactly what `apply` receives.
  apply(ctx, { refreshIntervalMs } as Config)
  return { ctx, tools, refreshIntervalMs }
}

describe('git-status host plugin', () => {
  it('registers the git_status tool with an implicit-open parameter root', () => {
    const b = bench()
    expect([...b.tools.keys()]).toEqual(['git_status'])
    const tool = b.tools.get('git_status')
    expect(tool?.description).toContain('git status')
    // `defineTool` compiles the implicit-open parameter root into JSON Schema.
    expect(tool?.parameters).toMatchObject({
      type: 'object',
      properties: {
        cwd: { type: 'string', description: expect.any(String) },
      },
    })
  })

  it('serves the panel auto-refresh configuration from the live volatile reference', async () => {
    const b = bench()
    const service = b.ctx.get('gitStatus') as { getPollConfig: () => Promise<{ refreshIntervalMs: number }> }
    expect(await service.getPollConfig()).toEqual({ refreshIntervalMs: 30_000 })

    // The Loader commits a Settings write into the same reference in place.
    b.refreshIntervalMs.commit(120_000)
    expect(await service.getPollConfig()).toEqual({ refreshIntervalMs: 120_000 })
  })

  it('addresses its settings form by the Cordis row id the patch inserts', () => {
    expect(SETTINGS_ENTRY_ID).toBe('dsh-plugin-git-status')
  })
})
