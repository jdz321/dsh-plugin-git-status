/**
 * Hand-written Typert Remote contribution mirroring the Host half's
 * `GitStatusService` (service `gitStatus`, method `status`). The Host Gateway
 * resolves the endpoint through SRC reflection; this client-side descriptor
 * tells the browser Gateway how to build the wire call. Codecs are strict but
 * schema-check only the JSON boundary shape — the payload vocabulary itself is
 * owned by the shared types module.
 * @module dsh-plugin-git-status/client/remote
 */

import type { TypertCodec, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { GitStatusResult } from '../types.ts'

/** Strict codec for the `cwd` argument: a non-empty string. */
const cwdCodec: TypertCodec = {
  mode: 'strict',
  typeSymbol: 'string',
  schema: {
    parse(value: unknown): string {
      if (typeof value !== 'string' || value === '') {
        throw new TypeError('git-status: cwd must be a non-empty string')
      }
      return value
    },
  },
}

/** Strict codec for the status result: a JSON object. */
const resultCodec: TypertCodec = {
  mode: 'strict',
  typeSymbol: 'GitStatusResult',
  schema: {
    parse(value: unknown): GitStatusResult {
      if (typeof value !== 'object' || value === null) {
        throw new TypeError('git-status: result must be an object')
      }
      return value as GitStatusResult
    },
  },
}

/** The `gitStatus` Remote contribution mounted by the browser half. */
export const gitStatusContribution: TypertRemoteContribution = {
  package: 'dsh-plugin-git-status',
  descriptors: [
    {
      id: 'gitStatus/status',
      service: 'gitStatus',
      namespace: 'gitStatus',
      method: 'status',
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'cwd', wire: 'cwd', source: 'json', codec: cwdCodec },
      ],
      result: resultCodec,
    },
  ],
}
