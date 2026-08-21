/**
 * The plugin's card inside the Plugins settings section
 * (`settings.plugin.item`, keyed by the `dsh-plugin-git-status` namespace).
 * Edits the panel auto-refresh interval through the bound settings scope; the
 * Host service reads the same document, so a save takes effect live.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button, IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import css from './plugin-card.module.css'

/** The settings section this card edits — a subset of the Host Config. */
export interface GitPluginSettings {
  /** Milliseconds between automatic refreshes; 0 disables auto-refresh. */
  refreshIntervalMs?: number
}

const MIN_MS = 0
const MAX_MS = 3_600_000

export type GitStatusPluginCardProps =
  PropsRuntime<'settings.plugin.item'>
  & { scope: SettingsScope<GitPluginSettings> }
  & PropsLocale<'git-status'>

export function GitStatusPluginCard({ scope, t }: GitStatusPluginCardProps) {
  const snapshot = useSyncExternalStore(scope.subscribe, scope.getSnapshot)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (snapshot.status !== 'ready') return null

  const value = snapshot.value?.refreshIntervalMs
  const writable = snapshot.writable
  const overridden = snapshot.user !== undefined
    && typeof snapshot.user === 'object'
    && 'refreshIntervalMs' in (snapshot.user as object)

  // Follow the accepted value (initial load and after every committed write).
  useEffect(() => {
    setDraft(value === undefined ? '' : String(value))
  }, [value])

  const parsed = draft === '' ? undefined : Number(draft)
  const valid = parsed !== undefined
    && Number.isInteger(parsed)
    && parsed >= MIN_MS
    && parsed <= MAX_MS
  const dirty = valid && parsed !== value

  const save = async (): Promise<void> => {
    if (parsed === undefined || !valid) {
      setError(t('settings.invalid'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await scope.set('refreshIntervalMs', parsed)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
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
    <li className={css.card}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name}>{t('settings.title')}</span>
          <span className={css.description}>{t('settings.description')}</span>
        </span>
        <IconChevronDownOutline14 className={open ? `${css.chevron} ${css.chevronOpen}` : css.chevron} />
      </button>
      {open && (
        <div className={css.body}>
          {!writable && <p className={css.readOnly} role="status">{t('settings.readOnly')}</p>}
          <div className={css.field}>
            <div className={css.fieldHead}>
              <label className={css.label} htmlFor="plugin-config-git-refresh">{t('settings.refreshIntervalMs')}</label>
              {overridden && <span className={css.badge}>{t('settings.overridden')}</span>}
            </div>
            <input
              id="plugin-config-git-refresh"
              className={css.input}
              type="text"
              inputMode="numeric"
              value={draft}
              disabled={!writable || saving}
              placeholder={value === undefined ? String(MAX_MS) : String(value)}
              aria-label={t('settings.refreshIntervalMs')}
              onChange={(e) => { setDraft(e.target.value); setError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') void save() }}
            />
            <p className={css.hint}>{t('settings.refreshIntervalMsHint')}</p>
            {error !== null && <p className={css.error} role="alert">{error}</p>}
          </div>
          <div className={css.footer}>
            <Button
              variant="ghost"
              size="sm"
              disabled={!writable || saving || !overridden}
              onClick={() => { void reset() }}
            >
              {t('settings.reset')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!writable || saving || !dirty}
              onClick={() => { void save() }}
            >
              {t('settings.save')}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
