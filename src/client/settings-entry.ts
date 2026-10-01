/**
 * The binding between this plugin's browser half and its Host settings entry:
 * the entry id its form is addressed by, the shape the entry carries, and the
 * live mirror the panel reads the accepted value through.
 *
 * Imported by both the panel and the settings page, so it deliberately pulls
 * no component module: everything here is cordis types plus one small store.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: the ctx.configForms Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'

/**
 * The settings entry this plugin's form edits. The Host settings service
 * addresses forms by Loader entry id, so the value equals the `id` of the row
 * `cordis.patch.yml` inserts (the Host half exports the same string).
 */
export const SETTINGS_ENTRY_ID = 'dsh-plugin-git-status'

/** The settings section this plugin edits — a subset of the Host Config. */
export interface GitPluginSettings {
  /** Milliseconds between automatic refreshes; 0 disables auto-refresh. */
  refreshIntervalMs?: number
}

/**
 * Live mirror of the accepted `refreshIntervalMs`. It reads `undefined` while
 * the settings entry is not served to this client, which leaves the Remote
 * value as the only source.
 */
export interface PollIntervalWatch {
  /** @returns the accepted interval, or undefined while the entry is unserved. */
  getSnapshot(): number | undefined
  /**
   * Observe accepted-value changes.
   * @param listener - invoked after each change.
   * @returns the disposer removing this listener.
   */
  subscribe(listener: () => void): () => void
}

/**
 * Follow the accepted refresh interval of this plugin's Host settings entry.
 *
 * A settings save is a revision-fenced write to the Host document; the shared
 * form publishes the new accepted value, which this mirror folds in so the
 * panel restarts its timer without a reload. The subscription lives on a child
 * fiber of `ctx`, so it ends with the caller.
 * @param ctx - the client context carrying the shared configuration forms.
 * @returns the mirror the panel component subscribes to.
 */
export function watchRefreshInterval(ctx: ClientContext): PollIntervalWatch {
  const listeners = new Set<() => void>()
  let accepted: number | undefined
  const publish = (next: number | undefined): void => {
    if (next === accepted) return
    accepted = next
    for (const listener of listeners) listener()
  }

  ctx.inject(['configForms'], (formCtx: ClientContext): (() => void) => {
    const form = formCtx.configForms.get<GitPluginSettings>(SETTINGS_ENTRY_ID)
    const read = (): void => {
      const snapshot = form.getSnapshot()
      publish(snapshot.status === 'ready' ? snapshot.value?.refreshIntervalMs : undefined)
    }
    read()
    return form.subscribe(read)
  })

  return {
    getSnapshot: () => accepted,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
