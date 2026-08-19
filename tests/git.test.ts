import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  emptyStatus,
  parseBranchInfo,
  parseFileEntries,
  parseRecentCommit,
  runGitStatus,
} from '../src/git'

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' })
}

describe('parseBranchInfo', () => {
  it('parses branch, upstream, ahead and behind', () => {
    const output = [
      '# branch.oid 0123456',
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -3',
    ].join('\n')
    expect(parseBranchInfo(output)).toEqual({ branch: 'main', upstream: 'origin/main', ahead: 2, behind: 3 })
  })

  it('treats a detached head and a missing upstream as empty', () => {
    const output = ['# branch.oid 0123456', '# branch.head (detached)'].join('\n')
    expect(parseBranchInfo(output)).toEqual({ branch: '(detached)', upstream: undefined, ahead: 0, behind: 0 })
  })
})

describe('parseFileEntries', () => {
  it('groups entries by porcelain status and keeps rename origins', () => {
    const output = [
      'M  staged.txt',
      ' M unstaged.txt',
      'MM both.txt',
      '?? untracked.txt',
      'R  renamed.txt',
      'old.txt',
      'UU conflicted.txt',
    ].join('\0') + '\0'
    const groups = parseFileEntries(output)
    expect(groups.conflicted).toEqual([{ status: 'UU', path: 'conflicted.txt' }])
    expect(groups.staged).toEqual([
      { status: 'M ', path: 'staged.txt' },
      { status: 'MM', path: 'both.txt' },
      { status: 'R ', path: 'renamed.txt', originalPath: 'old.txt' },
    ])
    expect(groups.unstaged).toEqual([
      { status: ' M', path: 'unstaged.txt' },
      { status: 'MM', path: 'both.txt' },
    ])
    expect(groups.untracked).toEqual([{ status: '??', path: 'untracked.txt' }])
  })

  it('preserves spaces inside paths', () => {
    const output = '?? some file.txt\0 M also changed.txt\0'
    const groups = parseFileEntries(output)
    expect(groups.untracked).toEqual([{ status: '??', path: 'some file.txt' }])
    expect(groups.unstaged).toEqual([{ status: ' M', path: 'also changed.txt' }])
  })
})

describe('parseRecentCommit', () => {
  it('parses hash, author, date and subject', () => {
    const output = 'abcdef1234\0Alice\0 2026-01-01T00:00:00+00:00\0Initial commit\n'
    expect(parseRecentCommit(output)).toEqual({
      hash: 'abcdef1234',
      author: 'Alice',
      date: ' 2026-01-01T00:00:00+00:00',
      subject: 'Initial commit',
    })
  })

  it('returns undefined for an empty log', () => {
    expect(parseRecentCommit('')).toBeUndefined()
  })
})

describe('emptyStatus', () => {
  it('marks the directory as not a repository', () => {
    const status = emptyStatus('/tmp/not-a-repo')
    expect(status).toMatchObject({
      repo: '/tmp/not-a-repo',
      isRepo: false,
      changeCount: 0,
      clean: true,
    })
  })
})

describe('runGitStatus', () => {
  it('reports a clean repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'git-status-'))
    git(dir, ['init', '-q'])
    git(dir, ['config', 'user.email', 'test@example.com'])
    git(dir, ['config', 'user.name', 'Test'])
    writeFileSync(join(dir, 'a.txt'), 'a\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-qm', 'init'])

    return runGitStatus(dir).then((status) => {
      expect(status.isRepo).toBe(true)
      expect(status.branch).toBe('main')
      expect(status.clean).toBe(true)
      expect(status.changeCount).toBe(0)
      expect(status.recentCommit?.subject).toBe('init')
    })
  })

  it('counts staged, unstaged and untracked changes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'git-status-'))
    git(dir, ['init', '-q'])
    git(dir, ['config', 'user.email', 'test@example.com'])
    git(dir, ['config', 'user.name', 'Test'])
    writeFileSync(join(dir, 'a.txt'), 'a\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-qm', 'init'])

    writeFileSync(join(dir, 'a.txt'), 'changed\n')
    writeFileSync(join(dir, 'staged.txt'), 'new\n')
    writeFileSync(join(dir, 'untracked.txt'), 'new\n')
    git(dir, ['add', 'staged.txt'])

    return runGitStatus(dir).then((status) => {
      expect(status.isRepo).toBe(true)
      expect(status.clean).toBe(false)
      expect(status.changeCount).toBe(3)
      expect(status.counts).toMatchObject({ staged: 1, unstaged: 1, untracked: 1, conflicted: 0 })
    })
  })

  it('reports a non-repository directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'git-status-'))
    return runGitStatus(dir).then((status) => {
      expect(status.isRepo).toBe(false)
    })
  })
})
