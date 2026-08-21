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
  'settings.saving': '保存中…',
  'settings.discard': '放弃修改',
  'settings.reset': '恢复默认',
  'settings.unsaved': '未保存',
  'settings.expand': '展开设置',
  'settings.collapse': '收起设置',
  'settings.overridden': '已覆盖',
  'settings.invalid': '请填数字；留空表示使用默认值。',
  'settings.saveFailed': '本部署没有接受这些值，已保留供你修改。',
  'settings.readOnly': '本部署的设置为只读。',
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
  'settings.saving': 'Saving…',
  'settings.discard': 'Discard',
  'settings.reset': 'Reset to default',
  'settings.unsaved': 'Unsaved',
  'settings.expand': 'Show settings',
  'settings.collapse': 'Hide settings',
  'settings.overridden': 'Overridden',
  'settings.invalid': 'Enter a number, or leave blank to use the default.',
  'settings.saveFailed': 'The deployment did not accept these values; they were left for you to correct.',
  'settings.readOnly': 'This deployment stores settings read-only.',
} satisfies Record<GitStatusKey, string>
