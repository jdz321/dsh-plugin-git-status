/**
 * The `git_status` model tool: lets the agent read a repository's git status
 * through the normal tool pipeline, so the call and its result land in the
 * session log and the trajectory view (an agent operation, unlike the panel's
 * silent UI polling). The canonical value is the structured GitStatusResult
 * JSON; the model-facing content is that JSON pretty-printed.
 *
 * The definition is hand-written (no `defineTool` VALUE import — it is just an
 * identity function, so its type alone provides the typing). `@deepseek-ai/*`
 * appear only as `import type`, erased at build: the built `lib/` carries no
 * runtime dependency on them.
 * @module dsh-plugin-git-status/tool
 */

import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import type { ShellExecutor } from '@deepseek-ai/dsh-shell'
import type { GitStatusResult } from './types.js'
import { runGitStatus } from './runner.js'

/** Cap on file entries included in the model-facing JSON. */
const RENDER_ENTRY_LIMIT = 100

/** Project one status result to bounded, pretty-printed JSON for the model. */
function renderStatusJson(result: GitStatusResult): string {
  if (!result.ok) return JSON.stringify(result, null, 2)
  const entries = result.entries.length > RENDER_ENTRY_LIMIT
    ? result.entries.slice(0, RENDER_ENTRY_LIMIT)
    : result.entries
  const bounded = {
    ...result,
    entries,
    truncated: result.truncated || result.entries.length > RENDER_ENTRY_LIMIT,
  }
  return JSON.stringify(bounded, null, 2)
}

/**
 * Build a registry-ready tool definition bound to one shell runner.
 * @param shell - the bash executor service.
 * @returns the tool definition object.
 */
export function createGitStatusTool(shell: ShellExecutor): ToolDefinition {
  return {
    name: 'git_status',
    description: '读取 Git 仓库的状态并返回 JSON：分支、相对上游的领先/落后、已暂存/未暂存/未跟踪/冲突的变更计数与文件列表（最多 100 条）、最近提交。省略 cwd 时使用当前会话工作区。',
    parameters: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: '要检查的目录路径；省略时使用当前会话工作区。',
        },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render(_args: unknown, value: JsonValue): ContentBlock[] {
        return [{ type: 'text', text: renderStatusJson(value as unknown as GitStatusResult) }]
      },
    },
    execute: async (args, exec) => {
      const { cwd } = args as { cwd?: string }
      const agent = exec.agent as { session?: { header?: { cwd?: string } } } | undefined
      const dir = typeof cwd === 'string' && cwd !== ''
        ? cwd
        : agent?.session?.header?.cwd
      if (dir === undefined) {
        throw new Error('git_status: 无法确定工作目录（当前会话没有 cwd），请显式传入 cwd 参数')
      }
      const result = await runGitStatus(shell, dir)
      if (!result.ok) throw new Error(result.error)
      return result as unknown as JsonValue
    },
  }
}
