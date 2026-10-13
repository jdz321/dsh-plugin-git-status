/**
 * Browser half of dsh-plugin-git-status.
 *
 * The `gitStatus` Remote namespace is provided by `ctx.remote.$mount(...)`,
 * but consuming it (`ctx.remote.gitStatus`) requires the `remote.gitStatus`
 * service in `inject`. A single plugin cannot both mount the namespace and
 * inject it (that would deadlock), so the mount lives in a provider child
 * plugin and the panel in a consumer child plugin that waits on
 * `remote.gitStatus`. The settings page is a third child plugin: it binds this
 * plugin's own Host settings entry through the shared `configForms` service.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only merges: the client Remote surface, the `conversation.input.right`
// slot declaration, the shared configuration forms, and the Plugins page's
// bundle-config slot declaration. Cross-plugin collaboration goes through
// cordis services, never a value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { GitStatusBar } from './GitStatusBar'
import { GitStatusSettingsCard, GitStatusSettingsCardController } from './PluginConfigCard'
import { SETTINGS_ENTRY_ID, watchRefreshInterval, type GitPluginSettings } from './settings-entry'
import { en, zh, type GitStatusKey } from './locales'
import { gitStatusRemote } from '../remote'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'git-status': GitStatusKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'git-status'

/**
 * `plugins.bundle.config` key for this plugin: the Plugins page dispatches a
 * bundle's configuration by its package name.
 */
const BUNDLE_NAME = 'dsh-plugin-git-status'

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

  // Consumer: waits for `remote.gitStatus`, then registers the panel. The panel
  // also mirrors the Host settings entry when this deployment serves it, so a
  // save restarts its auto-refresh timer immediately; the Remote value stands
  // in everywhere else, which keeps the panel working without the settings UI.
  ctx.plugin({
    name: 'git-status-panel',
    inject: ['slots', 'remote', 'remote.gitStatus', 'locale'],
    apply: (panelCtx: ClientContext): void => {
      const pollWatch = watchRefreshInterval(panelCtx)
      panelCtx.slots.inject('conversation.input.right', () => panelCtx.slots.register({
        name: 'conversation.input.right',
        id: 'git-status',
        order: 0,
        locale: NS,
        inject: () => ({
          status: (cwd: string) => panelCtx.remote.gitStatus.status(cwd),
          getPollConfig: () => panelCtx.remote.gitStatus.getPollConfig(),
          pollWatch,
        }),
      }, GitStatusBar))
    },
  })

  // Settings page: registers into the Plugins page's bundle-config seat while
  // the Host serves this plugin's settings entry. The entry appears there only
  // when its Config declares at least one volatile field, so a deployment that
  // never exposed it shows no trace of the page.
  ctx.plugin({
    name: 'git-status-settings',
    inject: ['slots', 'locale', 'configForms'],
    apply: (settingsCtx: ClientContext): void => {
      const card = new GitStatusSettingsCardController(settingsCtx.configForms.get<GitPluginSettings>(SETTINGS_ENTRY_ID))
      settingsCtx.effect(() => () => { card.dispose() }, 'git-status: settings form subscription')
      settingsCtx.effect(() => settingsCtx.configForms.whileServed([SETTINGS_ENTRY_ID], () => (
        settingsCtx.slots.inject('plugins.bundle.config', () => settingsCtx.slots.register({
          name: 'plugins.bundle.config',
          key: BUNDLE_NAME,
          locale: NS,
          inject: () => card.inject(),
        }, GitStatusSettingsCard))
      )), 'git-status: settings page')
    },
  })
}
