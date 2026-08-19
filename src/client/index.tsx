/**
 * Browser half of dsh-plugin-git-status: mounts the `gitStatus` Remote and
 * registers the read-only status chip into the composer tool row, left of the
 * model selector.
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

/** Required services: slots for the panel, remote for the Host call, locale for copy. */
export const inject = ['slots', 'remote', 'locale']

/**
 * Client plugin body.
 * @param ctx - client root context.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'git-status: locale')

  const disposeRemote = await ctx.remote.$mount(gitStatusRemote)

  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: 'git-status',
    order: 0,
    locale: NS,
    inject: () => ({
      status: (cwd: string) => ctx.remote.gitStatus.status(cwd),
    }),
  }, GitStatusBar))

  return async () => { await disposeRemote() }
}
