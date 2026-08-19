/**
 * Browser card of dsh-plugin-git-status: a one-line git summary (branch +
 * change-file count + refresh) rendered in the composer tool row right before
 * the model selector (`conversation.input.right`). Borderless to match the
 * tool-row controls; when the workspace is dirty the count is a trigger that
 * toggles a floating grouped file list beneath the row. All colors use the
 * --dsw-alias-* theme tokens; the row keeps the InputZone one-row height
 * budget.
 * @module dsh-plugin-git-status/client/GitStatusLine
 */

import React from 'react'
import type { GitStatusEntry, GitStatusResult } from '../types.js'

/** The inject face this card receives from its registration. */
export interface GitStatusInjected {
  /** Invoke the host `gitStatus/status` Remote. */
  status: (cwd: string) => Promise<GitStatusResult>
}

/** Standard slot props this card reads (selector hooks + session id). */
export interface GitStatusStandardProps {
  sessionId?: string
  useSessions: <S>(sel: (state: unknown) => S) => S
  useWorkspaces: <S>(sel: (state: unknown) => S) => S
}

/** Complete props: inject face + the standard props this card reads. */
export type GitStatusLineProps = GitStatusInjected & GitStatusStandardProps

/** View state of the one-line summary. */
interface GitStatusView {
  /** `hidden` means the workspace is not a git repository — render nothing. */
  phase: 'loading' | 'ready' | 'error' | 'hidden'
  data: GitStatusResult | null
  error: string | null
}

/** Whether a host failure detail means the directory is not a git repository. */
function isNotGitRepository(raw: string | undefined): boolean {
  return /not a git repository/i.test(String(raw ?? ''))
}

/** Map a host failure detail to a friendly Chinese message. */
function friendlyError(raw: string | undefined): string {
  const text = String(raw ?? '')
  if (/not a git repository/i.test(text)) return '当前目录不是 Git 仓库'
  if (/not a git command|git: command not found|command not found/i.test(text)) return '环境中未找到 git 命令'
  return text || '无法读取 Git 状态'
}

/** Resolve the workspace path from the session list, then the workspace list. */
function resolveCwd(
  sessionId: string | undefined,
  sessions: { byId?: Record<string, { cwd?: string } | undefined> },
  workspaces: { recentWorkspaceId?: string; items?: Array<{ workspaceId?: string; path?: string }> },
): string | null {
  const session = sessionId === undefined ? undefined : sessions.byId?.[sessionId]
  if (session?.cwd) return session.cwd
  const recentId = workspaces.recentWorkspaceId
  if (recentId !== undefined) {
    const ws = workspaces.items?.find(item => item.workspaceId === recentId)
    if (ws?.path) return ws.path
  }
  return null
}

/** One status column is a change when it is not blank, `.`, or `?`. */
function isChange(column: string): boolean {
  return column !== ' ' && column !== '.' && column !== '?'
}

/** Group entries by status kind for the expanded file list. */
function groupEntries(entries: readonly GitStatusEntry[]): Record<string, GitStatusEntry[]> {
  const groups: Record<string, GitStatusEntry[]> = { conflicted: [], staged: [], unstaged: [], untracked: [] }
  for (const entry of entries) {
    if (entry.kind === 'conflicted') groups.conflicted.push(entry)
    else if (entry.kind === 'untracked') groups.untracked.push(entry)
    else {
      if (isChange(entry.x)) groups.staged.push(entry)
      if (isChange(entry.y)) groups.unstaged.push(entry)
    }
  }
  return groups
}

/** Inline styles; colors ride the --dsw-alias-* theme tokens. */
const style = {
  wrapper: {
    position: 'relative',
  } as const,
  line: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-secondary)',
    maxWidth: '100%',
  } as const,
  branch: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: 'var(--dsw-alias-label-primary)',
    whiteSpace: 'nowrap' as const,
  },
  branchIcon: {
    flex: 'none' as const,
    color: 'var(--dsw-alias-label-secondary)',
  },
  clean: { color: 'var(--dsw-alias-state-success-primary)' },
  conflict: { color: 'var(--dsw-alias-state-error-primary)' },
  trigger: {
    padding: 0,
    fontSize: 12,
    color: 'var(--dsw-alias-label-secondary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  refresh: {
    padding: 0,
    fontSize: 12,
    color: 'var(--dsw-alias-label-secondary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    flex: 'none' as const,
  },
  muted: { color: 'var(--dsw-alias-label-secondary)' },
  error: {
    color: 'var(--dsw-alias-state-error-primary)',
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    zIndex: 40,
    minWidth: 280,
    maxWidth: 420,
    maxHeight: 300,
    overflowY: 'auto',
    padding: 8,
    fontSize: 12,
    color: 'var(--dsw-alias-label-primary)',
    background: 'var(--dsw-alias-bg-overlay)',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } as const,
  groupTitle: { color: 'var(--dsw-alias-label-secondary)', marginTop: 2 },
  entry: {
    display: 'flex',
    gap: 8,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 12,
    whiteSpace: 'nowrap' as const,
  },
  letters: { flex: 'none' as const, color: 'var(--dsw-alias-label-secondary)' },
  path: { overflow: 'hidden', textOverflow: 'ellipsis' },
} as const

/** Group display order and labels for the expanded list. */
const GROUP_ORDER = ['conflicted', 'staged', 'unstaged', 'untracked'] as const
const GROUP_LABEL: Record<string, string> = {
  conflicted: '冲突',
  staged: '已暂存',
  unstaged: '未暂存',
  untracked: '未跟踪',
}

/**
 * The one-line git summary: branch, dirty-file count (toggles the file list)
 * or clean, and refresh.
 * @param props - inject face and the standard slot props this card reads.
 */
export function GitStatusLine(props: GitStatusLineProps): React.ReactElement | null {
  const sessions = props.useSessions((s) => s) as { byId?: Record<string, { cwd?: string } | undefined> }
  const workspaces = props.useWorkspaces((s) => s) as {
    recentWorkspaceId?: string
    items?: Array<{ workspaceId?: string; path?: string }>
  }
  const cwd = resolveCwd(props.sessionId, sessions, workspaces)

  const [view, setView] = React.useState<GitStatusView>({
    phase: 'loading',
    data: null,
    error: null,
  })
  const [expanded, setExpanded] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  // Close the expanded file list when a click lands outside this card.
  React.useEffect(() => {
    if (!expanded) return
    const onPointerDown = (event: MouseEvent): void => {
      const node = event.target as Node | null
      if (wrapperRef.current !== null && !wrapperRef.current.contains(node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [expanded])

  const refresh = React.useCallback(() => {
    if (cwd === null) {
      setView({ phase: 'error', data: null, error: '未找到当前工作区路径' })
      return
    }
    setView(prev => ({ ...prev, phase: 'loading' }))
    props.status(cwd)
      .then((result) => {
        if (result.ok) {
          setView({ phase: 'ready', data: result, error: null })
        } else if (isNotGitRepository(result.error)) {
          // Not a git repository: hide the whole widget (keep polling so a
          // later `git init` brings it back).
          setView({ phase: 'hidden', data: null, error: null })
        } else {
          setView({ phase: 'error', data: null, error: friendlyError(result.error) })
        }
      })
      .catch((error: unknown) => {
        setView({
          phase: 'error',
          data: null,
          error: error instanceof Error ? error.message : String(error),
        })
      })
  }, [cwd, props.status])

  React.useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 30000)
    return () => window.clearInterval(id)
  }, [refresh])

  // Not a git repository: render nothing (no tool-row space taken).
  if (view.phase === 'hidden') return null

  const cells: React.ReactNode[] = []
  if (view.phase === 'loading' && view.data === null) {
    cells.push(<span key="l" style={style.muted}>…</span>)
  } else if (view.phase === 'error') {
    cells.push(<span key="e" style={style.error}>{view.error}</span>)
  } else if (view.data?.ok === true) {
    const branch = view.data.branch
    const counts = view.data.counts
    cells.push(
      <span key="b" style={style.branch}>
        <svg
          style={style.branchIcon}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 6a9 9 0 0 0-9 9V3" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
        </svg>
        {branch.name || '游离 HEAD'}
      </span>,
    )
    if (counts.total === 0) {
      cells.push(<span key="s" style={style.clean}>✓ 干净</span>)
    } else {
      const fileCount = view.data.entries.length
      const label = view.data.truncated ? `≥${fileCount} 个文件有变更` : `${fileCount} 个文件有变更`
      cells.push(
        <button
          key="t"
          type="button"
          style={style.trigger}
          title="展开文件列表"
          onClick={() => { setExpanded(prev => !prev) }}
        >
          {label}
        </button>,
      )
      if (counts.conflicted > 0) {
        cells.push(<span key="cf" style={style.conflict}>冲突 {counts.conflicted}</span>)
      }
    }
  }
  cells.push(
    <button key="r" type="button" style={style.refresh} title="刷新" onClick={refresh}>↻</button>,
  )

  const data = view.data
  const groups = expanded && data?.ok === true && data.counts.total > 0
    ? groupEntries(data.entries)
    : null

  return (
    <div ref={wrapperRef} style={style.wrapper}>
      <div style={style.line}>{cells}</div>
      {groups !== null && (
        <div style={style.panel}>
          {GROUP_ORDER.map((group) => {
            const entries = groups[group]
            if (entries.length === 0) return null
            return (
              <React.Fragment key={group}>
                <div style={style.groupTitle}>{GROUP_LABEL[group]}（{entries.length}）</div>
                {entries.map(entry => (
                  <div key={group + ':' + entry.path + entry.x + entry.y} style={style.entry}>
                    <span style={style.letters}>{entry.x}{entry.y}</span>
                    <span style={style.path}>{entry.path}{entry.orig ? `（原 ${entry.orig}）` : ''}</span>
                  </div>
                ))}
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
