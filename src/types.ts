/**
 * Shared wire vocabulary of the git-status Remote: JSON-serializable types
 * produced by the Host half and consumed by the browser half.
 * @module dsh-plugin-git-status/types
 */

/** Branch header facts parsed from the `## ` line of `git status --porcelain=v1 -b`. */
export interface GitStatusBranch {
  /** Local branch name; empty when porcelain prints no name. */
  name: string
  /** Upstream tracking ref, when one exists. */
  upstream: string | null
  /** Commits ahead of the upstream. */
  ahead: number
  /** Commits behind the upstream. */
  behind: number
  /** True when the upstream was deleted (`[gone]`). */
  gone: boolean
}

/** One porcelain entry: the two status columns plus the path. */
export interface GitStatusEntry {
  /** Index (staged) status column; `?` for untracked. */
  x: string
  /** Worktree (unstaged) status column; `?` for untracked. */
  y: string
  /** Current path; destination path for a rename/copy. */
  path: string
  /** Original path for a rename/copy, null otherwise. */
  orig: string | null
  /** Grouping the entry belongs to. */
  kind: 'tracked' | 'untracked' | 'conflicted'
}

/** Aggregated per-group change counts. */
export interface GitStatusCounts {
  staged: number
  unstaged: number
  untracked: number
  conflicted: number
  total: number
}

/** Last-commit summary, when the repository has commits. */
export interface GitStatusCommit {
  hash: string
  subject: string
}

/** Success branch of the status read. */
export interface GitStatusSuccess {
  ok: true
  /** Directory the status was read for. */
  cwd: string
  branch: GitStatusBranch
  counts: GitStatusCounts
  entries: GitStatusEntry[]
  /** True when the entry list was capped at 500. */
  truncated: boolean
  commit: GitStatusCommit | null
}

/** Failure branch: git unavailable, not a repository, or an infra error. */
export interface GitStatusFailure {
  ok: false
  cwd?: string
  /** Human-readable technical detail (git's stderr, etc.). */
  error: string
}

/** The complete `gitStatus/status` result. */
export type GitStatusResult = GitStatusSuccess | GitStatusFailure
