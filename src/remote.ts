/**
 * Client Remote contribution for the `gitStatus` Host service, plus the
 * type augmentation that makes `ctx.remote.gitStatus.status(...)` visible.
 * This module is bundled into the client artifact.
 */

import { z } from 'zod'
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { GitStatusSnapshotSchema } from './schema'
import type { GitStatusSnapshot } from './types'

interface GitStatusRemoteNamespace {
  status: (cwd?: string) => Promise<RemoteResult<GitStatusSnapshot>>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    gitStatus: GitStatusRemoteNamespace
  }
}

export const gitStatusRemote: TypertRemoteContribution = {
  package: 'dsh-plugin-git-status',
  descriptors: [
    {
      id: 'dsh-plugin-git-status#gitStatus/status',
      service: 'gitStatus',
      namespace: 'gitStatus',
      method: 'status',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'cwd',
          wire: 'cwd',
          source: 'json',
          acceptsUndefined: true,
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-plugin-git-status/types#CwdArg',
            schema: z.string().optional(),
          },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: 'dsh-plugin-git-status/types#GitStatusSnapshot',
        schema: GitStatusSnapshotSchema,
      },
    },
  ],
}

export default gitStatusRemote
