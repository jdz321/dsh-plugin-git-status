/**
 * Browser half of dsh-plugin-git-status: mounts the hand-written `gitStatus`
 * Remote contribution, then registers the one-line git summary into the
 * composer tool row, right before the model selector
 * (`conversation.input.right`, id `git-status`).
 * @module dsh-plugin-git-status/client
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only merges: pull the ctx.remote and ctx.slots declarations into the
// compilation face (the same way shipped client plugins do); erased at bundle
// time, so they never reach the loader module table.
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { GitStatusResult } from '../types.js'
import { gitStatusContribution } from './gitStatusRemote.js'
import { GitStatusLine } from './GitStatusLine.jsx'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    /** The git-status Remote mounted by this plugin. */
    gitStatus: {
      status(cwd: string): Promise<GitStatusResult>
    }
  }
}

/** Required services: the slot registry and the typed Client Remote. */
export const inject = ['slots', 'remote']

/**
 * Client plugin body: mount the Remote and register the input-row card.
 *
 * The `remote.gitStatus` namespace service is created by `$mount` itself, so it
 * must not be declared in `inject` (that would self-wait before apply runs).
 * Instead the status face awaits the mount, then reads the namespace through
 * `ctx.get` — the explicit global-service read the Guard permits without an
 * injection.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  const mounted = ctx.remote.$mount(gitStatusContribution)
  ctx.effect(() => {
    return () => {
      // Unmount owns the namespace: dispose after mount settles; a failed
      // mount has nothing to dispose and must not surface a rejection.
      void mounted.then(dispose => dispose(), () => undefined)
    }
  }, 'git-status: remote mount')

  ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
    {
      name: 'conversation.input.right',
      id: 'git-status',
      order: 0,
      inject: () => ({
        status: async (cwd: string): Promise<GitStatusResult> => {
          await mounted
          const namespace = ctx.get('remote.gitStatus') as
            | { status(cwd: string): Promise<RemoteResult<GitStatusResult>> }
            | undefined
          if (namespace === undefined) {
            return { ok: false, error: 'gitStatus Remote 未挂载' }
          }
          // Remote namespace methods carry a RemoteResult envelope
          // ({ ok, value } / { ok, error }); unwrap it to the business result.
          const carried = await namespace.status(cwd)
          if (!carried.ok) {
            return { ok: false, error: carried.error.message ?? '远程调用失败' }
          }
          return carried.value
        },
      }),
    },
    GitStatusLine,
  ))
}
