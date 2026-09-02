/**
 * The plugin's card inside the Plugins settings section
 * (`settings.plugin.item`, keyed by the `dsh-plugin-git-status` namespace).
 * Edits the panel auto-refresh interval through the bound settings scope; the
 * Host service reads the same document, so a save takes effect live.
 *
 * The official plugin cards (`PluginCard`/`ValueField`) live inside
 * `@deepseek-ai/dsh-client-ui-settings-plugins`, which is not a shared browser
 * module an external plugin may import, so this card mirrors their layout and
 * surface tokens locally.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import css from './plugin-card.module.css'

/** The settings section this card edits — a subset of the Host Config. */
export interface GitPluginSettings {
  /** Milliseconds between automatic refreshes; 0 disables auto-refresh. */
  refreshIntervalMs?: number
}

/** Placeholder when no value has ever been accepted. */
const MAX_MS = 3_600_000

export type GitStatusPluginCardProps =
  PropsRuntime<'settings.plugin.item'>
  & { scope: SettingsScope<GitPluginSettings> }
  & PropsLocale<'git-status'>

export function GitStatusPluginCard({ scope, t }: GitStatusPluginCardProps) {
  // React calls the store callbacks without `this`, so bind the scope's
  // methods through stable wrappers (the scope itself is stable).
  const subscribe = useMemo(
    () => (listener: () => void) => scope.subscribe(listener),
    [scope],
  )
  const getSnapshot = useMemo(
    () => () => scope.getSnapshot(),
    [scope],
  )
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (snapshot.status !== 'ready') return null

  const value = snapshot.value?.refreshIntervalMs
  const writable = snapshot.writable
  const existingOverride = snapshot.user !== undefined
    && typeof snapshot.user === 'object'
    && 'refreshIntervalMs' in (snapshot.user as object)

  // Follow the accepted value (initial load and after every committed write).
  useEffect(() => {
    setDraft(value === undefined ? '' : String(value))
  }, [value])

  const parsed = Number(draft)
  /** Empty draft means "use the default" (a clear); a non-numeric draft is invalid. */
  const invalid = draft !== '' && !Number.isFinite(parsed)
  /** A staged edit exists when the draft differs from the accepted value. */
  const dirty = String(value ?? '') !== draft
  /** Saving would leave a user-layer entry for this field. */
  const overridden = existingOverride || (draft !== '' && !invalid)

  const save = async (): Promise<void> => {
    if (invalid) {
      setError(t('settings.invalid'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (draft === '') {
        // Leaving the field blank restores the composition default.
        await scope.unset('refreshIntervalMs')
      } else {
        await scope.set('refreshIntervalMs', parsed)
      }
    } catch (cause) {
      setError(t('settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const discard = (): void => {
    setDraft(value === undefined ? '' : String(value))
    setError(null)
  }

  const reset = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      await scope.unset('refreshIntervalMs')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className={open ? `${css.card} ${css.cardOpen}` : css.card}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        aria-label={`${t(open ? 'settings.collapse' : 'settings.expand')}: ${t('settings.title')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name}>{t('settings.title')}</span>
          <span className={css.description}>{t('settings.description')}</span>
        </span>
        {dirty && <span className={css.pending}>{t('settings.unsaved')}</span>}
        <IconChevronDownOutline14 className={open ? `${css.chevron} ${css.chevronOpen}` : css.chevron} />
      </button>
      {open && (
        <div className={css.body}>
          {!writable && <p className={css.readOnly} role="status">{t('settings.readOnly')}</p>}
          <div className={css.field}>
            <div className={css.head}>
              <label className={css.label} htmlFor="plugin-config-git-refresh">{t('settings.refreshIntervalMs')}</label>
              {overridden && (
                <span className={css.badges}>
                  <span className={css.badge}>{t('settings.overridden')}</span>
                  <button
                    type="button"
                    className={css.reset}
                    disabled={!writable || saving}
                    onClick={() => { void reset() }}
                  >
                    {t('settings.reset')}
                  </button>
                </span>
              )}
            </div>
            <input
              id="plugin-config-git-refresh"
              className={invalid ? css.inputInvalid : css.input}
              type="text"
              inputMode="numeric"
              aria-invalid={invalid}
              value={draft}
              disabled={!writable || saving}
              placeholder={value === undefined ? String(MAX_MS) : String(value)}
              onChange={(e) => { setDraft(e.target.value); setError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') void save() }}
            />
            <p className={invalid ? css.invalid : css.hint}>
              {invalid ? t('settings.invalid') : t('settings.refreshIntervalMsHint')}
            </p>
          </div>
          <div className={css.footer}>
            {error !== null && <p className={css.failed} role="status">{error}</p>}
            <button
              type="button"
              className={css.discard}
              disabled={!dirty || saving}
              onClick={discard}
            >
              {t('settings.discard')}
            </button>
            <button
              type="button"
              className={css.save}
              disabled={!dirty || invalid || saving}
              onClick={() => { void save() }}
            >
              {t(saving ? 'settings.saving' : 'settings.save')}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
