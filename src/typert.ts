/**
 * Host `TYPERT` manifest. The Harness typert-loader imports this module (via
 * the package `./typert` export) when the plugin mounts and registers the
 * strict invocation descriptor, so the Gateway can resolve `gitStatus/status`
 * without falling back to source parsing.
 *
 * The type is a compile-time guarantee only: `@deepseek-ai/dsh-typert-registry`
 * is a dev dependency and the import is erased, so the shipped artifact stays a
 * plain manifest object. Typing it here is what makes a codec that lost its
 * `create()` factory — the startup failure on 0.2.0-rc.2 — a build error
 * instead of a refusal at plugin mount.
 */

import { z } from 'zod'
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry'
import { GitStatusSnapshotSchema, PollConfigSchema } from './schema'

export const TYPERT: TypertContribution = {
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
            // 0.2.0-rc.2 strict codecs carry a lazily materialized schema factory.
            create: () => z.string().optional(),
          },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: 'dsh-plugin-git-status/types#GitStatusSnapshot',
        create: () => GitStatusSnapshotSchema,
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
        create: () => PollConfigSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 1, column: 1 },
    },
  ],
  model: { services: [], events: [], objects: [] },
}

export default TYPERT
