/**
 * The plugin's own settings page inside the Plugins panel, registered into the
 * `plugins.bundle.config` keyed slot (the seat the Plugins page documents for a
 * bundle's configuration). It edits the panel auto-refresh interval through the
 * shared `configForms` service, which the Host settings page also uses; a save
 * is one revision-fenced write, and the Host commits it into the running
 * `Volatile` reference so the panel picks it up without a reload.
 *
 * The page chrome, the staged form model, and the controls all come from
 * `@deepseek-ai/dsh-client-ui-primitives`, the same public surface the shipped
 * companion settings pages build on.
 */

import { SettingsForm, SettingsFormModel, SettingsValueField, settingsNumberField } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SettingsFieldState, SettingsFormActions, SettingsFormScope, SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the Plugins page's SlotMap merge (the 'plugins.bundle.config' entry).
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { formLabels } from './locales'
import { SETTINGS_ENTRY_ID, type GitPluginSettings } from './settings-entry'

/** What the page renders. */
export interface GitStatusCardState extends SettingsFormShell {
  /** Panel auto-refresh interval. */
  refreshIntervalMs: SettingsFieldState
}

/** The registration-side face the page's slot entry injects. */
export interface GitStatusCardFace extends SettingsFormActions {
  hooks: {
    /** Page snapshot bound by the renderer as `useGitStatusCard`. */
    gitStatusCard: SnapshotStore<GitStatusCardState>
  }
}

/** Bridges the settings entry onto the page's staged form. */
export class GitStatusSettingsCardController {
  private readonly form: SettingsFormModel<GitPluginSettings>
  private readonly store: SnapshotStore<GitStatusCardState>

  /** @param scope - the shared configuration form for this plugin's Host entry. */
  constructor(scope: SettingsFormScope<GitPluginSettings>) {
    this.form = new SettingsFormModel(scope, [settingsNumberField('refreshIntervalMs')])
    this.store = this.form.bind(() => this.projection())
  }

  private projection(): GitStatusCardState {
    return { ...this.form.shell(), refreshIntervalMs: this.form.field('refreshIntervalMs') }
  }

  /**
   * Build the face the page's slot entry injects.
   * @returns the page's snapshot and its form actions.
   */
  inject(): GitStatusCardFace {
    return { hooks: { gitStatusCard: this.store }, ...this.form.actions() }
  }

  /** Release accepted-value subscriptions. */
  dispose(): void { this.form.dispose() }
}

/** Props the renderer binds for this plugin's settings page. */
export type GitStatusSettingsCardProps =
  PropsRuntime<'plugins.bundle.config'>
  & PropsLocale<'git-status'>
  & InjectFace<GitStatusCardFace>

/**
 * Render the plugin's one-liner or its settings form, as the Plugins page asks.
 * @param props - the view asked for, locale copy, the form snapshot, and its actions.
 * @returns the one-liner, or the staged form.
 */
export function GitStatusSettingsCard(props: GitStatusSettingsCardProps) {
  const { t } = props
  const state = props.useGitStatusCard(snapshot => snapshot)
  if (props.view === 'summary') return t('settings.description')
  return (
    <SettingsForm labels={formLabels(t)} state={state} onSave={props.save} onDiscard={props.discard}>
      <SettingsValueField
        id="plugin-config-git-refresh"
        label={t('settings.refreshIntervalMs')}
        hint={t('settings.refreshIntervalMsHint')}
        overriddenLabel={t('settings.overridden')}
        resetLabel={t('settings.reset')}
        invalidLabel={t('settings.invalid')}
        numeric
        disabled={!state.writable}
        {...state.refreshIntervalMs}
        onEdit={(text) => { props.edit('refreshIntervalMs', text) }}
        onReset={() => { props.resetField('refreshIntervalMs') }}
      />
    </SettingsForm>
  )
}
