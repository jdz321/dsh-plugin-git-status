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
  'settings.title': 'Git 状态',
  'settings.description': '工作区 Git 状态面板的自动刷新间隔。',
  'settings.refreshIntervalMs': '自动刷新间隔（毫秒）',
  'settings.refreshIntervalMsHint': '两次自动刷新之间的间隔；设为 0 关闭自动刷新。',
  'settings.save': '保存',
  'settings.reset': '重置',
  'settings.overridden': '已覆盖',
  'settings.invalid': '请输入 0–3600000 之间的整数',
  'settings.readOnly': '当前连接不支持写入设置。',
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
  'settings.title': 'Git status',
  'settings.description': 'Auto-refresh interval for the workspace git status panel.',
  'settings.refreshIntervalMs': 'Auto-refresh interval (ms)',
  'settings.refreshIntervalMsHint': 'Delay between automatic refreshes; 0 disables auto-refresh.',
  'settings.save': 'Save',
  'settings.reset': 'Reset',
  'settings.overridden': 'Overridden',
  'settings.invalid': 'Enter an integer between 0 and 3600000',
  'settings.readOnly': 'Writes are unavailable on this connection.',
} satisfies Record<GitStatusKey, string>
