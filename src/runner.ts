/**
 * Shared git-status runner: executes the read-only git commands through the
 * DSH `shell` service and parses porcelain output. Used by both the Remote
 * `gitStatus/status` endpoint and the `git_status` model tool.
 * @module dsh-plugin-git-status/runner
 */

import type { ShellExecRequest, ShellRunResult } from '@deepseek-ai/dsh-shell'
import type {
  GitStatusBranch,
  GitStatusCommit,
  GitStatusCounts,
  GitStatusEntry,
  GitStatusResult,
} from './types.js'

/** Structural face of the DSH bash executor this package consumes. */
export interface ShellRunner {
  resolve(request: ShellExecRequest): unknown
  run(spec: unknown): Promise<ShellRunResult>
}

/** Porcelain conflict pairs: both columns in conflict states. */
const CONFLICT_XY = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

/** Cap on parsed entries; larger repos report `truncated: true`. */
const MAX_ENTRIES = 500

/** One status column is a change when it is not blank, `.`, or `?`. */
function isChange(column: string): boolean {
  return column !== ' ' && column !== '.' && column !== '?'
}

/**
 * Parse `git status --porcelain=v1 -b` stdout into the JSON-safe summary.
 * @param text - raw git stdout.
 * @returns branch header, per-file entries, and aggregated counts.
 */
export function parseStatus(text: string): {
  branch: GitStatusBranch
  counts: GitStatusCounts
  entries: GitStatusEntry[]
  truncated: boolean
} {
  const branch: GitStatusBranch = { name: '', upstream: null, ahead: 0, behind: 0, gone: false }
  const entries: GitStatusEntry[] = []
  const counts: GitStatusCounts = { staged: 0, unstaged: 0, untracked: 0, conflicted: 0, total: 0 }
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (line === '') continue
    if (line.startsWith('## ')) {
      let rest = line.slice(3)
      let bracket = ''
      const bi = rest.indexOf(' [')
      if (bi >= 0) {
        bracket = rest.slice(bi + 2)
        rest = rest.slice(0, bi)
      }
      const dots = rest.indexOf('...')
      if (dots >= 0) {
        branch.name = rest.slice(0, dots)
        branch.upstream = rest.slice(dots + 3)
      } else {
        branch.name = rest
      }
      if (bracket === 'gone') branch.gone = true
      const ahead = /ahead (\d+)/.exec(bracket)
      const behind = /behind (\d+)/.exec(bracket)
      if (ahead !== null) branch.ahead = Number(ahead[1])
      if (behind !== null) branch.behind = Number(behind[1])
      continue
    }
    if (line.startsWith('?? ')) {
      entries.push({ x: '?', y: '?', path: line.slice(3), orig: null, kind: 'untracked' })
      counts.untracked += 1
      continue
    }
    const x = line[0] ?? ' '
    const y = line[1] ?? ' '
    let path = line.slice(3)
    let orig: string | null = null
    if (x === 'R' || x === 'C') {
      const arrow = path.indexOf(' -> ')
      if (arrow >= 0) {
        orig = path.slice(0, arrow)
        path = path.slice(arrow + 4)
      }
    }
    const conflicted = CONFLICT_XY.has(x + y)
    entries.push({ x, y, path, orig, kind: conflicted ? 'conflicted' : 'tracked' })
    if (conflicted) counts.conflicted += 1
    if (isChange(x)) counts.staged += 1
    if (isChange(y)) counts.unstaged += 1
  }
  counts.total = counts.staged + counts.unstaged + counts.untracked + counts.conflicted
  const truncated = entries.length > MAX_ENTRIES
  if (truncated) entries.length = MAX_ENTRIES
  return { branch, counts, entries, truncated }
}

/**
 * Read the git status of one directory through a shell runner.
 * @param shell - the bash executor service.
 * @param cwd - absolute directory to inspect.
 * @returns the parsed status summary, or a structured failure.
 */
export async function runGitStatus(shell: ShellRunner, cwd: string): Promise<GitStatusResult> {
  const runGit = async (command: string): Promise<ShellRunResult> => {
    const request: ShellExecRequest = {
      command,
      workdir: cwd,
      timeoutMs: 8000,
      stdoutMaxBytes: 4 * 1024 * 1024,
    }
    try {
      return await shell.run(shell.resolve(request))
    } catch (error) {
      return {
        exitCode: -1,
        signal: null,
        timedOut: false,
        aborted: false,
        timeoutMs: 8000,
        stdout: { text: '', truncated: false },
        stderr: { text: error instanceof Error ? error.message : String(error), truncated: false },
      }
    }
  }

  const status = await runGit('git -c core.quotePath=false status --porcelain=v1 -b')
  if (status.exitCode !== 0) {
    const detail = (status.stderr.text || status.stdout.text || '').trim()
    return { ok: false, cwd, error: detail || `git exited with ${String(status.exitCode)}` }
  }

  const parsed = parseStatus(status.stdout.text)
  const log = await runGit('git -c core.quotePath=false log -1 --format=%h%x09%s')
  let commit: GitStatusCommit | null = null
  if (log.exitCode === 0) {
    const line = log.stdout.text.trim()
    const tab = line.indexOf('\t')
    if (tab >= 0) commit = { hash: line.slice(0, tab), subject: line.slice(tab + 1) }
  }
  return {
    ok: true,
    cwd,
    branch: parsed.branch,
    counts: parsed.counts,
    entries: parsed.entries,
    truncated: parsed.truncated,
    commit,
  }
}
