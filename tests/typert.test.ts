/**
 * Wire-contract tests for both Typert faces.
 *
 * 0.2.0-rc.2 changed strict codecs from a materialized `schema` to a `create()`
 * factory, and the typert-loader refuses to register a contribution whose codec
 * lacks one — the exact startup failure this plugin hit on upgrade. Both
 * validators below are the real ones the harness runs: the loader's activation
 * check and the registry those descriptors are committed to. The client
 * contribution is checked against the same codec contract, because the Gateway
 * client validates it when the browser half mounts the namespace.
 */

import { Context } from '@deepseek-ai/cordis'
import { validateTypertManifest } from '@deepseek-ai/dsh-typert-loader'
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry'
import { describe, expect, it } from 'vitest'
import { TYPERT } from '../src/typert'
import { gitStatusRemote } from '../src/remote'

interface StrictCodec {
  mode?: string
  typeSymbol?: string
  create?: () => { parse: (value: unknown) => unknown }
}

interface DescriptorLike {
  parameters: readonly { codec: StrictCodec }[]
  result: StrictCodec
}

/** Every codec one descriptor list carries, parameters first. */
function codecsOf(descriptors: readonly DescriptorLike[]): StrictCodec[] {
  return descriptors.flatMap(descriptor => [
    ...descriptor.parameters.map(parameter => parameter.codec),
    descriptor.result,
  ])
}

function expectStrictCodecs(descriptors: readonly DescriptorLike[]): void {
  const codecs = codecsOf(descriptors)
  expect(codecs.length).toBeGreaterThan(0)
  for (const codec of codecs) {
    expect(codec.mode).toBe('strict')
    expect(typeof codec.typeSymbol).toBe('string')
    expect(typeof codec.create).toBe('function')
    // `create()` must materialize a real runtime schema, not just return a value.
    expect(typeof codec.create?.().parse).toBe('function')
  }
}

describe('host TYPERT manifest', () => {
  it('passes the typert-loader validation the harness runs when the plugin mounts', () => {
    const manifest = validateTypertManifest('dsh-plugin-git-status', TYPERT)
    expect(manifest.invocations.map(invocation => invocation.id)).toEqual([
      'dsh-plugin-git-status#gitStatus/status',
      'dsh-plugin-git-status#gitStatus/getPollConfig',
    ])
  })

  it('registers into the real typert registry and withdraws again', async () => {
    const ctx = new Context()
    const registry = new TypertRegistry(ctx)
    const dispose = registry.register(TYPERT)
    expect(registry.getPackage('dsh-plugin-git-status', 'host')).toBeDefined()
    await dispose()
    expect(registry.getPackage('dsh-plugin-git-status', 'host')).toBeUndefined()
  })

  it('declares only strict codecs carrying a create() factory', () => {
    expectStrictCodecs(TYPERT.invocations)
  })
})

describe('client Remote contribution', () => {
  it('is owned by this package and carries the same codec contract', () => {
    expect(gitStatusRemote.package).toBe('dsh-plugin-git-status')
    expect(gitStatusRemote.descriptors.map(descriptor => descriptor.id)).toEqual([
      'dsh-plugin-git-status#gitStatus/status',
      'dsh-plugin-git-status#gitStatus/getPollConfig',
    ])
    expectStrictCodecs(gitStatusRemote.descriptors)
  })

  it('validates a snapshot through the status result codec', () => {
    const descriptor = gitStatusRemote.descriptors.find(candidate => candidate.method === 'status')
    const codec = descriptor?.result as StrictCodec | undefined
    const parse = codec?.create?.().parse
    expect(parse).toBeTypeOf('function')
    expect(parse?.({
      repo: '/repo',
      isRepo: true,
      branch: 'main',
      ahead: 0,
      behind: 0,
      clean: true,
      changeCount: 0,
      counts: { conflicted: 0, staged: 0, unstaged: 0, untracked: 0 },
      groups: { conflicted: [], staged: [], unstaged: [], untracked: [] },
    })).toMatchObject({ branch: 'main', isRepo: true })
  })
})
