/**
 * Host entry for dsh-plugin-git-status.
 *
 * Registers two capabilities that share one read-only git inspector:
 *  - the `gitStatus` Remote service, exposed to the browser panel, and
 *  - the model-facing `git_status` tool.
 */

import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { runGitStatus } from './git'
import type { GitStatusSnapshot } from './types'

export const name = 'dsh-plugin-git-status'
export const inject = ['tools']

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
  constructor(ctx: Context) {
    super(ctx, 'gitStatus')
  }

  /** Inspect the git status of one directory (defaults to the host cwd). */
  async status(cwd?: string): Promise<GitStatusSnapshot> {
    return runGitStatus(cwd)
  }
}

export function apply(ctx: Context): void {
  ctx.plugin(GitStatusService)

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
