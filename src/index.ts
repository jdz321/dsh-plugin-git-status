/**
 * Host entry for dsh-plugin-git-status.
 *
 * Registers two capabilities that share one read-only git inspector:
 *  - the `gitStatus` Remote service, exposed to the browser panel, and
 *  - the model-facing `git_status` tool.
 *
 * `refreshIntervalMs` is a volatile configuration field: the Loader keeps the
 * `Volatile` reference handed to `apply` and commits a Settings write into it
 * in place, so the Remote reads the live value without a remount.
 */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { runGitStatus } from './git'
import type { GitStatusSnapshot, PollConfig } from './types'

export const name = 'dsh-plugin-git-status'
export const inject = ['tools']

/**
 * Cordis entry id this plugin's settings form is addressed by. The Host
 * settings service keys every form by its Loader entry id, so this value must
 * stay equal to the `id` of the inserted row in `cordis.patch.yml`.
 */
export const SETTINGS_ENTRY_ID = 'dsh-plugin-git-status'

/** Plugin configuration. */
export interface Config {
  /**
   * Milliseconds between automatic panel refreshes. `0` disables auto-refresh;
   * the panel then only updates on the manual refresh button or a session
   * change.
   */
  refreshIntervalMs: Volatile<number>
}

/**
 * Schemastery config: invalid values fail loud at load time. The volatile
 * marker makes the field editable from the Plugins page and live in the
 * running fiber.
 */
export const Config = Schema.object({
  refreshIntervalMs: Schema.natural().max(3_600_000).default(30_000).volatile(),
})

const FILE_ENTRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', required: true },
    path: { type: 'string', required: true },
    originalPath: { type: 'string' },
  },
} as const

const RECENT_COMMIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    hash: { type: 'string', required: true },
    subject: { type: 'string', required: true },
    author: { type: 'string', required: true },
    date: { type: 'string', required: true },
  },
} as const

const GIT_STATUS_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    repo: { type: 'string', required: true },
    isRepo: { type: 'boolean', required: true },
    branch: { type: 'string', required: true },
    upstream: { type: 'string' },
    ahead: { type: 'integer', required: true },
    behind: { type: 'integer', required: true },
    clean: { type: 'boolean', required: true },
    changeCount: { type: 'integer', required: true },
    counts: {
      type: 'object',
      additionalProperties: false,
      required: true,
      properties: {
        conflicted: { type: 'integer', required: true },
        staged: { type: 'integer', required: true },
        unstaged: { type: 'integer', required: true },
        untracked: { type: 'integer', required: true },
      },
    },
    groups: {
      type: 'object',
      additionalProperties: false,
      required: true,
      properties: {
        conflicted: { type: 'array', items: FILE_ENTRY_SCHEMA, required: true },
        staged: { type: 'array', items: FILE_ENTRY_SCHEMA, required: true },
        unstaged: { type: 'array', items: FILE_ENTRY_SCHEMA, required: true },
        untracked: { type: 'array', items: FILE_ENTRY_SCHEMA, required: true },
      },
    },
    recentCommit: RECENT_COMMIT_SCHEMA,
  },
} as const

const TOOL_DESCRIPTION =
  'Read the git status of a working directory without modifying anything. Returns structured JSON with the '
  + 'current branch, commits ahead/behind its upstream, grouped change counts (conflicted / staged / unstaged / '
  + 'untracked), the changed file list with porcelain status codes (renames include their original path), and '
  + 'the most recent commit. Pass `cwd` to inspect a specific directory; omit it to inspect the current session '
  + 'workspace.'

/** Remote service consumed by the browser panel. */
export class GitStatusService extends TypertRemoteService {
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'gitStatus')
  }

  /** Inspect the git status of one directory (defaults to the host cwd). */
  async status(cwd?: string): Promise<GitStatusSnapshot> {
    return runGitStatus(cwd)
  }

  /**
   * Panel auto-refresh configuration, read live from the committed volatile
   * reference so a Settings write takes effect without a remount.
   */
  async getPollConfig(): Promise<PollConfig> {
    return { refreshIntervalMs: this.config.refreshIntervalMs.get() }
  }
}

export function apply(ctx: Context, config: Config): void {
  // Direct construction (not ctx.plugin) so the service receives the entry;
  // the Service base registers itself and is unregistered with this fiber.
  new GitStatusService(ctx, config)

  ctx.tools.register(defineTool({
    name: 'git_status',
    description: TOOL_DESCRIPTION,
    parameters: {
      cwd: {
        type: 'string',
        description: 'Optional absolute path to inspect. Omit to use the current session workspace.',
      },
    },
    output: {
      schema: GIT_STATUS_OUTPUT_SCHEMA,
      render: (_args: unknown, value: GitStatusSnapshot) => [
        { type: 'text' as const, text: JSON.stringify(value) },
      ],
    },
    execute(args, exec) {
      const cwd = args.cwd ?? exec.agent?.session.header.cwd
      return Promise.resolve(runGitStatus(cwd))
    },
    presentCall: (args) => ({
      card: 'generic',
      title: 'Git status',
      kind: 'read',
      ...(args.cwd !== undefined ? { rawInput: args.cwd } : {}),
    }),
  }))
}
