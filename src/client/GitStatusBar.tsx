/**
 * Read-only git status chip rendered in the composer tool row. Fetches the
 * current workspace's status through the plugin Remote, refreshes every 30s,
 * and expands a grouped change list on click.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconBranchOutline16,
  IconRefreshOutline16,
  Tooltip,
  useDismissOnOutsidePointer,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { GitFileEntry, GitStatusSnapshot } from '../types'
import css from './styles.module.css'

/** Auto-refresh cadence for the panel. */
const REFRESH_INTERVAL_MS = 30_000

/** Business face injected by the slot registration. */
export interface GitStatusBarInjected {
  status: (cwd: string) => Promise<RemoteResult<GitStatusSnapshot>>
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

export function GitStatusBar({ sessionId, useSessions, status, t }: GitStatusBarProps) {
  const cwd = useSessions((state) => state.byId[sessionId]?.cwd)
  const [snapshot, setSnapshot] = useState<GitStatusSnapshot | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useDismissOnOutsidePointer(rootRef, expanded, setExpanded)

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

  useEffect(() => {
    if (cwd === undefined) {
      setSnapshot(null)
      setExpanded(false)
      return
    }
    void load()
    const timer = setInterval(() => { void load() }, REFRESH_INTERVAL_MS)
    return () => { clearInterval(timer) }
  }, [cwd, load])

  if (cwd === undefined || snapshot === null || !snapshot.isRepo) return null

  return (
    <div ref={rootRef} className={css.root}>
      <span className={css.branch}>
        <IconBranchOutline16 size={14} />
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
          <IconRefreshOutline16 size={14} />
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
