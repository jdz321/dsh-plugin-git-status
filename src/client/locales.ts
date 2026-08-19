/** `git-status` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  clean: '✓ 干净',
  changes: '{count} 个文件有变更',
  refresh: '刷新',
  'group.conflicted': '冲突',
  'group.staged': '已暂存',
  'group.unstaged': '未暂存',
  'group.untracked': '未跟踪',
  'rename.from': '原 {path}',
} satisfies Record<string, string>

/** The git-status namespace key union. */
export type GitStatusKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  clean: '✓ clean',
  changes: '{count} file(s) changed',
  refresh: 'Refresh',
  'group.conflicted': 'Conflicted',
  'group.staged': 'Staged',
  'group.unstaged': 'Unstaged',
  'group.untracked': 'Untracked',
  'rename.from': 'from {path}',
} satisfies Record<GitStatusKey, string>
