/**
 * Host half of dsh-plugin-git-status: a Typert Remote Service that reads the
 * git status of a workspace directory through the DSH `shell` service and
 * returns a JSON-serializable summary, plus the `git_status` model tool so an
 * agent can query status through the normal tool pipeline (session-logged,
 * trajectory-visible). The Typert Gateway discovers the service through SRC
 * reflection (the `typertRemote` binding + `@Remote` markers), so no generated
 * artifact is required — the browser half mounts the matching hand-written
 * descriptor contribution.
 * @module dsh-plugin-git-status
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { GitStatusResult } from './types.js'
import { parseStatus, runGitStatus } from './runner.js'
import { createGitStatusTool } from './tool.js'

export type * from './types.js'
export { parseStatus } from './runner.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    gitStatus: GitStatusService
  }
}

/**
 * The `gitStatus` Remote service. Runs read-only git commands in the target
 * directory; failures are returned as structured `{ ok: false }` results
 * rather than thrown, so the browser half renders them instead of a wire error.
 * The `git_status` tool is registered once the service activates (when the
 * `tools` registry is present).
 */
export class GitStatusService extends TypertRemoteService {
  static inject = ['shell']

  /**
   * @param ctx - Host context carrying the bash executor service.
   */
  constructor(ctx: Context) {
    super(ctx, 'gitStatus')
  }

  /** Register the git_status tool and own its disposer. */
  protected async [Service.init](): Promise<void> {
    const tools = this.ctx.get('tools') as { register(definition: unknown): () => void } | undefined
    if (tools === undefined) return
    this.ctx.effect(() => tools.register(createGitStatusTool(this.ctx.shell)), 'git-status: tool')
  }

  /**
   * Read the git status of one workspace directory.
   * @param cwd - absolute workspace directory to inspect.
   * @returns the parsed status summary, or a structured failure.
   */
  @Remote('status')
  async status(cwd: string): Promise<GitStatusResult> {
    return runGitStatus(this.ctx.shell, cwd)
  }
}

export default GitStatusService
