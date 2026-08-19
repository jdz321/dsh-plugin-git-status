/**
 * Read-only git inspection: `git status` / `git log` executed through
 * `child_process.execFile` (argument list, never a shell). Every command is a
 * read-only query; this module never mutates the repository.
 */

import { execFile } from 'node:child_process'
import type { GitFileEntry, GitStatusGroups, GitStatusSnapshot } from './types'

/** Unmerged (conflicted) porcelain `XY` codes. */
const UNMERGED_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

const NOT_A_REPO_PATTERN = /not a git repository/i

interface GitError extends Error {
  exitCode?: number
  notRepo: boolean
}

function isGitError(error: unknown): error is GitError {
  return error instanceof Error && 'notRepo' in error
}

/** A `GitStatusSnapshot` for a directory that is not a git repository. */
export function emptyStatus(repo: string): GitStatusSnapshot {
  return {
    repo,
    isRepo: false,
    branch: '',
    ahead: 0,
    behind: 0,
    clean: true,
    changeCount: 0,
    counts: { conflicted: 0, staged: 0, unstaged: 0, untracked: 0 },
    groups: { conflicted: [], staged: [], unstaged: [], untracked: [] },
  }
}

/** Run one git command and resolve with its trimmed stdout. */
function runGit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const message = (stderr ?? '').trim() || error.message
        const notRepo = NOT_A_REPO_PATTERN.test(stderr ?? '') || NOT_A_REPO_PATTERN.test(error.message)
        const wrapped = new Error(message) as GitError
        wrapped.exitCode = typeof error.code === 'number' ? error.code : undefined
        wrapped.notRepo = notRepo
        reject(wrapped)
        return
      }
      resolve(stdout)
    })
  })
}

/** Parse `# branch.*` headers from `git status --porcelain=v2 --branch`. */
export function parseBranchInfo(output: string): {
  branch: string
  upstream?: string
  ahead: number
  behind: number
} {
  let branch = ''
  let upstream: string | undefined
  let ahead = 0
  let behind = 0
  for (const line of output.split('\n')) {
    if (line.startsWith('# branch.head ')) {
      branch = line.slice('# branch.head '.length).trim()
    } else if (line.startsWith('# branch.upstream ')) {
      upstream = line.slice('# branch.upstream '.length).trim()
    } else if (line.startsWith('# branch.ab ')) {
      const match = line.slice('# branch.ab '.length).trim().match(/^\+(\d+) -(\d+)$/)
      if (match !== null) {
        ahead = Number(match[1])
        behind = Number(match[2])
      }
    }
  }
  return { branch, upstream, ahead, behind }
}

/** Parse `git status --porcelain=v1 -z` into grouped file entries. */
export function parseFileEntries(output: string): GitStatusGroups {
  const conflicted: GitFileEntry[] = []
  const staged: GitFileEntry[] = []
  const unstaged: GitFileEntry[] = []
  const untracked: GitFileEntry[] = []
  const records = output.split('\0')

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (record === undefined || record === '') continue
    const status = record.slice(0, 2)
    // v1 porcelain is `XY PATH`: two status columns, one separator space, path.
    const path = record.slice(3)

    if (status === '??') {
      untracked.push({ status, path })
      continue
    }

    if (status[0] === 'R' || status[0] === 'C') {
      // Rename/copy: the original path follows as the next NUL record.
      const originalPath = records[index + 1]
      if (originalPath !== undefined && originalPath !== '') {
        staged.push({ status, path, originalPath })
        index += 1
      } else {
        staged.push({ status, path })
      }
      continue
    }

    if (UNMERGED_CODES.has(status)) {
      conflicted.push({ status, path })
      continue
    }

    const indexStatus = status[0] ?? ' '
    const worktreeStatus = status[1] ?? ' '
    if (indexStatus !== ' ') staged.push({ status, path })
    if (worktreeStatus !== ' ') unstaged.push({ status, path })
  }

  return { conflicted, staged, unstaged, untracked }
}

/** Parse `git log -1 --format=%H%x00%an%x00%aI%x00%s` into a commit view. */
export function parseRecentCommit(output: string): GitStatusSnapshot['recentCommit'] {
  const fields = output.trim().split('\0')
  if (fields.length < 4 || fields[0] === '') return undefined
  return {
    hash: fields[0] ?? '',
    author: fields[1] ?? '',
    date: fields[2] ?? '',
    subject: fields.slice(3).join('\0') ?? '',
  }
}

/** Resolve a cwd that is empty/undefined to the process working directory. */
function resolveCwd(cwd: string | undefined): string {
  return cwd === undefined || cwd.trim() === '' ? process.cwd() : cwd
}

/** Inspect the git status of one directory. Never mutates the repository. */
export async function runGitStatus(cwd?: string): Promise<GitStatusSnapshot> {
  const repo = resolveCwd(cwd)
  const base = emptyStatus(repo)

  let branchOut: string
  let filesOut: string
  let logOut: string | undefined
  try {
    branchOut = await runGit(repo, ['status', '--porcelain=v2', '--branch'])
    filesOut = await runGit(repo, ['status', '--porcelain=v1', '-z'])
  } catch (error) {
    if (isGitError(error) && error.notRepo) return base
    throw error
  }

  const branch = parseBranchInfo(branchOut)
  const groups = parseFileEntries(filesOut)
  const changedPaths = new Set<string>()
  for (const entry of [...groups.conflicted, ...groups.staged, ...groups.unstaged, ...groups.untracked]) {
    changedPaths.add(entry.path)
  }
  const changeCount = changedPaths.size

  try {
    logOut = await runGit(repo, ['log', '-1', '--format=%H%x00%an%x00%aI%x00%s'])
  } catch {
    // A repository without any commit has no log; that is not an error.
    logOut = undefined
  }

  const recentCommit = logOut === undefined ? undefined : parseRecentCommit(logOut)
  const upstream = branch.upstream !== undefined && branch.upstream !== '' ? branch.upstream : undefined

  return {
    repo,
    isRepo: true,
    branch: branch.branch === '' ? '(detached)' : branch.branch,
    ...(upstream !== undefined ? { upstream } : {}),
    ahead: branch.ahead,
    behind: branch.behind,
    clean: changeCount === 0,
    changeCount,
    counts: {
      conflicted: groups.conflicted.length,
      staged: groups.staged.length,
      unstaged: groups.unstaged.length,
      untracked: groups.untracked.length,
    },
    groups,
    ...(recentCommit !== undefined ? { recentCommit } : {}),
  }
}
