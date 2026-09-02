/**
 * Browser half of dsh-plugin-git-status.
 *
 * The `gitStatus` Remote namespace is provided by `ctx.remote.$mount(...)`,
 * but consuming it (`ctx.remote.gitStatus`) requires the `remote.gitStatus`
 * service in `inject`. A single plugin cannot both mount the namespace and
 * inject it (that would deadlock), so the mount lives in a provider child
 * plugin and the panel in a consumer child plugin that waits on
 * `remote.gitStatus`. The settings card binds the plugin's own settings
 * namespace directly.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only merges: the client Remote surface, the `conversation.input.right`
// slot declaration, the settings scope, and the plugin-card slot declaration.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { GitStatusBar } from './GitStatusBar'
import { GitStatusPluginCard, type GitPluginSettings } from './PluginConfigCard'
import { en, zh, type GitStatusKey } from './locales'
import { gitStatusRemote } from '../remote'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'git-status': GitStatusKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'git-status'

/** Settings namespace value matching the Host `SETTINGS_NS`. */
const SETTINGS_NS_VALUE = 'dsh-plugin-git-status'

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

  // Consumer: waits for `remote.gitStatus`, then registers the panel. The
  // panel also binds the settings scope so a config-card save restarts its
  // auto-refresh timer immediately.
  ctx.plugin({
    name: 'git-status-panel',
    inject: ['slots', 'remote', 'remote.gitStatus', 'locale', 'settingsScope'],
    apply: (panelCtx: ClientContext): void => {
      const pollScope = panelCtx.settingsScope.bind<GitPluginSettings>({ namespace: SETTINGS_NS_VALUE })
      panelCtx.slots.inject('conversation.input.right', () => panelCtx.slots.register({
        name: 'conversation.input.right',
        id: 'git-status',
        order: 0,
        locale: NS,
        inject: () => ({
          status: (cwd: string) => panelCtx.remote.gitStatus.status(cwd),
          getPollConfig: () => panelCtx.remote.gitStatus.getPollConfig(),
          pollConfig: pollScope,
        }),
      }, GitStatusBar))
    },
  })

  // Settings card: registers into the plugin-configuration section, keyed by
  // the plugin's settings namespace. Root scope — the inject face carries the
  // bound scope, and the card derives its own snapshot from it.
  ctx.plugin({
    name: 'git-status-settings',
    inject: ['slots', 'locale', 'settingsScope'],
    apply: (settingsCtx: ClientContext): void => {
      const scope = settingsCtx.settingsScope.bind<GitPluginSettings>({ namespace: SETTINGS_NS_VALUE })
      settingsCtx.slots.inject('settings.plugin.item', () => settingsCtx.slots.register({
        name: 'settings.plugin.item',
        key: SETTINGS_NS_VALUE,
        locale: NS,
        inject: (): { scope: SettingsScope<GitPluginSettings> } => ({ scope }),
      }, GitStatusPluginCard))
    },
  })
}
