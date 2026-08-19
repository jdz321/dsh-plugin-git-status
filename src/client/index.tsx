/**
 * Browser half of dsh-plugin-git-status.
 *
 * The `gitStatus` Remote namespace is provided by `ctx.remote.$mount(...)`,
 * but consuming it (`ctx.remote.gitStatus`) requires the `remote.gitStatus`
 * service in `inject`. A single plugin cannot both mount the namespace and
 * inject it (that would deadlock), so the mount lives in a provider child
 * plugin and the panel in a consumer child plugin that waits on
 * `remote.gitStatus`.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only merges: the client Remote surface, the `conversation.input.right`
// slot declaration, and the locale service.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { GitStatusBar } from './GitStatusBar'
import { en, zh, type GitStatusKey } from './locales'
import { gitStatusRemote } from '../remote'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'git-status': GitStatusKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'git-status'

/** Required services of the outer plugin: locale for the copy. */
export const inject = ['locale']

/**
 * Client plugin body.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'git-status: locale')

  // Provider: mounts the gitStatus Remote namespace, which provides the
  // `remote.gitStatus` service for the consumer child below.
  ctx.plugin({
    name: 'git-status-remote',
    inject: ['remote'],
    apply: async (remoteCtx: ClientContext): Promise<() => Promise<void>> => {
      const dispose = await remoteCtx.remote.$mount(gitStatusRemote)
      return async () => { await dispose() }
    },
  })

  // Consumer: waits for `remote.gitStatus`, then registers the panel.
  ctx.plugin({
    name: 'git-status-panel',
    inject: ['slots', 'remote', 'remote.gitStatus', 'locale'],
    apply: (panelCtx: ClientContext): void => {
      panelCtx.slots.inject('conversation.input.right', () => panelCtx.slots.register({
        name: 'conversation.input.right',
        id: 'git-status',
        order: 0,
        locale: NS,
        inject: () => ({
          status: (cwd: string) => panelCtx.remote.gitStatus.status(cwd),
        }),
      }, GitStatusBar))
    },
  })
}
