/** One changed file in a git working tree. */
export interface GitFileEntry {
  /** Porcelain `XY` status code, e.g. `"M "`, `" A"`, `"??"`, `"UU"`, `"R "`. */
  status: string
  /** File path, relative to the repository root (new path for renames). */
  path: string
  /** Original path, present only for rename/copy entries. */
  originalPath?: string
}

/** Grouped file lists. */
export interface GitStatusGroups {
  /** Unmerged entries (conflicts). */
  conflicted: GitFileEntry[]
  /** Entries with staged (index) changes. */
  staged: GitFileEntry[]
  /** Entries with unstaged (worktree) changes. */
  unstaged: GitFileEntry[]
  /** Untracked entries. */
  untracked: GitFileEntry[]
}

/** Per-group change counts. */
export interface GitStatusCounts {
  conflicted: number
  staged: number
  unstaged: number
  untracked: number
}

/** The most recent commit, when the repository has one. */
export interface GitRecentCommit {
  hash: string
  subject: string
  author: string
  date: string
}

/** Structured git status for one directory. */
export interface GitStatusSnapshot {
  /** Absolute path that was inspected. */
  repo: string
  /** Whether `repo` is a git repository. */
  isRepo: boolean
  /** Current branch name (or a detached `HEAD` label). */
  branch: string
  /** Configured upstream branch, when present. */
  upstream?: string
  /** Commits ahead of upstream. */
  ahead: number
  /** Commits behind upstream. */
  behind: number
  /** Whether the working tree has no changes. */
  clean: boolean
  /** Total number of distinct changed files. */
  changeCount: number
  counts: GitStatusCounts
  groups: GitStatusGroups
  /** Most recent commit, when the repository has one. */
  recentCommit?: GitRecentCommit
}
