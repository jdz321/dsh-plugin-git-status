/**
 * Read-only git status chip rendered in the composer tool row. Fetches the
 * current workspace's status through the plugin Remote, auto-refreshes at the
 * interval configured on the Host (paused while the tab is hidden), and
 * expands a grouped change list on click.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  IconBranchOutlineRegular,
  IconRefreshOutlineRegular,
  Tooltip,
  useDismissOnOutsidePointer,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { GitFileEntry, GitStatusSnapshot, PollConfig } from '../types'
import type { PollIntervalWatch } from './settings-entry'
import css from './styles.module.css'

/** Business face injected by the slot registration. */
export interface GitStatusBarInjected {
  status: (cwd: string) => Promise<RemoteResult<GitStatusSnapshot>>
  getPollConfig: () => Promise<RemoteResult<PollConfig>>
  /** Live accepted interval from the Host settings entry, when it is served. */
  pollWatch: PollIntervalWatch
}

export type GitStatusBarProps = PropsRuntime<'conversation.input.right'> & GitStatusBarInjected & PropsLocale<'git-status'>

interface FileGroupProps {
  title: string
  entries: GitFileEntry[]
  statusClass?: string
  t: TranslateNS<'git-status'>
}

function FileGroup({ title, entries, statusClass, t }: FileGroupProps) {
  if (entries.length === 0) return null
  return (
    <div className={css.group}>
      <span className={css.groupTitle}>{title}</span>
      {entries.map((entry) => (
        <div key={`${entry.status}:${entry.path}`} className={css.file}>
          <span className={statusClass === undefined ? css.status : `${css.status} ${statusClass}`}>
            {entry.status}
          </span>
          <span className={css.path}>{entry.path}</span>
          {entry.originalPath !== undefined && (
            <span className={css.original}>{t('rename.from', { path: entry.originalPath })}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export function GitStatusBar({ sessionId, useSessions, status, getPollConfig, pollWatch, t }: GitStatusBarProps) {
  const cwd = useSessions((state: { byId: Record<string, { cwd?: string } | undefined> }) => state.byId[sessionId]?.cwd)
  const [snapshot, setSnapshot] = useState<GitStatusSnapshot | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  /** Auto-refresh cadence fetched from the Host; fallback while the settings entry is unserved. */
  const [remoteInterval, setRemoteInterval] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useDismissOnOutsidePointer(rootRef, expanded, setExpanded)

  // The plugin keeps `pollWatch` stable for the slot entry's lifetime, so the
  // store's callbacks can be passed to React directly.
  const acceptedInterval = useSyncExternalStore(pollWatch.subscribe, pollWatch.getSnapshot)

  const load = useCallback(async () => {
    if (cwd === undefined) return
    setRefreshing(true)
    try {
      const result = await status(cwd)
      setSnapshot(result.ok ? result.value : null)
    } finally {
      setRefreshing(false)
    }
  }, [cwd, status])

  // Initial value from the Host, used until a settings save publishes one.
  const refreshConfig = useCallback(async () => {
    const result = await getPollConfig()
    if (result.ok) setRemoteInterval(result.value.refreshIntervalMs)
  }, [getPollConfig])

  useEffect(() => {
    if (cwd === undefined) {
      setRemoteInterval(null)
      return
    }
    void refreshConfig()
  }, [cwd, refreshConfig])

  // A settings save folds the new value into `pollWatch`, which restarts the
  // timer immediately; the Remote value stands in everywhere else.
  const pollIntervalMs = acceptedInterval ?? remoteInterval

  // Initial load whenever the workspace changes.
  useEffect(() => {
    if (cwd === undefined) {
      setSnapshot(null)
      setExpanded(false)
      return
    }
    void load()
  }, [cwd, load])

  // Auto-refresh timer; paused while the tab is hidden, resumed (with an
  // immediate refresh) when it becomes visible again. A visible tab also
  // re-reads the Host value, so a change made from another browser or from the
  // profile patch lands without a reload.
  useEffect(() => {
    if (cwd === undefined) return
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      void refreshConfig()
      void load()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility) }
  }, [cwd, load, refreshConfig])

  useEffect(() => {
    if (cwd === undefined || pollIntervalMs === null || pollIntervalMs <= 0) return
    let timer: ReturnType<typeof setInterval> | undefined
    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    }
    const start = () => {
      stop()
      timer = setInterval(() => { void load() }, pollIntervalMs)
    }
    start()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [cwd, load, pollIntervalMs])

  if (cwd === undefined || snapshot === null || !snapshot.isRepo) return null

  return (
    <div ref={rootRef} className={css.root}>
      <span className={css.branch}>
        <IconBranchOutlineRegular size={14} />
        <span className={css.branchName}>{snapshot.branch}</span>
      </span>
      {snapshot.clean
        ? <span className={`${css.summary} ${css.summaryClean}`}>{t('clean')}</span>
        : (
          <button
            type="button"
            className={`${css.summary} ${css.summaryChanges}`}
            aria-expanded={expanded}
            onClick={() => { setExpanded((open) => !open) }}
          >
            {t('changes', { count: snapshot.changeCount })}
          </button>
        )}
      <Tooltip label={t('refresh')} side="top" delayMs={500}>
        <button
          type="button"
          className={css.refresh}
          aria-label={t('refresh')}
          disabled={refreshing}
          onClick={() => { void load() }}
        >
          <IconRefreshOutlineRegular size={14} />
        </button>
      </Tooltip>
      {expanded && (
        <div className={css.menu}>
          <FileGroup title={t('group.conflicted')} entries={snapshot.groups.conflicted} statusClass={css.statusConflict} t={t} />
          <FileGroup title={t('group.staged')} entries={snapshot.groups.staged} statusClass={css.statusStaged} t={t} />
          <FileGroup title={t('group.unstaged')} entries={snapshot.groups.unstaged} t={t} />
          <FileGroup title={t('group.untracked')} entries={snapshot.groups.untracked} statusClass={css.statusUntracked} t={t} />
        </div>
      )}
    </div>
  )
}
