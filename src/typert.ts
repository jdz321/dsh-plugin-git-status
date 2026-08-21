/**
 * Host `TYPERT` manifest. The Harness typert-loader imports this module (via
 * the package `./typert` export) when the plugin mounts and registers the
 * strict invocation descriptor, so the Gateway can resolve `gitStatus/status`
 * without falling back to source parsing.
 */

import { z } from 'zod'
import { GitStatusSnapshotSchema, PollConfigSchema } from './schema'

export const TYPERT = {
  package: 'dsh-plugin-git-status',
  face: 'host',
  schemas: [],
  invocations: [
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
      sourceLocation: { file: 'src/index.ts', line: 1, column: 1 },
    },
    {
      id: 'dsh-plugin-git-status#gitStatus/getPollConfig',
      service: 'gitStatus',
      namespace: 'gitStatus',
      method: 'getPollConfig',
      invocation: { kind: 'direct' },
      parameters: [],
      result: {
        mode: 'strict',
        typeSymbol: 'dsh-plugin-git-status/types#PollConfig',
        schema: PollConfigSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 1, column: 1 },
    },
  ],
  model: { services: [], events: [], objects: [] },
}

export default TYPERT
