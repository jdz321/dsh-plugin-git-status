/**
 * Host half of dsh-plugin-git-status: exposes the `gitStatus` Remote service
 * (reads a workspace's git status through the `shell` executor) and registers
 * the `git_status` model tool.
 *
 * A standalone package installed by name resolves its `@deepseek-ai/*`
 * dependencies to a different module instance than the Gateway's, so a
 * `Service` subclass would register into the wrong Cordis root. This plugin is
 * therefore a function plugin that imports `@deepseek-ai/*` types only; the
 * Remote endpoint is claimed explicitly through the shared Typert registry
 * (`typert.remotes.register`), and the service itself is provided with a
 * hand-written `typertRemote` binding.
 * @module dsh-plugin-git-status
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-shell'
import type { InvocationDescriptor, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { GitStatusResult } from './types.js'
import { parseStatus, runGitStatus } from './runner.js'
import { createGitStatusTool } from './tool.js'

export type * from './types.js'
export { parseStatus } from './runner.js'

/** The `gitStatus` service the browser half consumes. */
export interface GitStatusService {
  status(cwd: string): Promise<GitStatusResult>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    gitStatus: GitStatusService
  }
}

/** Host-side claim for the `gitStatus/status` Remote endpoint. */
const GIT_STATUS_CONTRIBUTION: TypertRemoteContribution = {
  package: 'dsh-plugin-git-status',
  descriptors: [
    {
      id: 'gitStatus/status',
      service: 'gitStatus',
      namespace: 'gitStatus',
      method: 'status',
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'cwd', wire: 'cwd', source: 'json', codec: { mode: 'src-json' } },
      ],
      result: { mode: 'src-json' },
    } satisfies InvocationDescriptor,
  ],
}

/** Cordis function-plugin name. */
export const name = 'git-status'

/** Required service: the bash executor. */
export const inject = ['shell']

/**
 * Plugin body: provide the `gitStatus` service, claim its Remote endpoint, and
 * register the `git_status` tool.
 * @param ctx - host context carrying the injected `shell` service.
 */
export function apply(ctx: Context): void {
  const service = {
    typertRemote: null as unknown,
    status(cwd: string): Promise<GitStatusResult> {
      return runGitStatus(ctx.shell, cwd)
    },
  }
  // The Gateway's validateBinding reads this binding (service/serviceKey/namespace).
  ;(service as { typertRemote: unknown }).typertRemote = {
    service,
    serviceKey: 'gitStatus',
    namespace: 'gitStatus',
  }

  ctx.provide('gitStatus', service)

  const typert = ctx.get('typert') as {
    remotes: { register(contribution: TypertRemoteContribution): () => Promise<void> }
  }
  ctx.effect(() => typert.remotes.register(GIT_STATUS_CONTRIBUTION), 'git-status: typert remote')

  const tools = ctx.get('tools') as { register(definition: ToolDefinition): () => void }
  ctx.effect(() => tools.register(createGitStatusTool(ctx.shell)), 'git-status: tool')
}
