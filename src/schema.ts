/** Zod v4 schemas shared by the Host `TYPERT` and Client `TYPERT_REMOTE` codecs. */

import { z } from 'zod'

export const GitFileEntrySchema = z.object({
  status: z.string(),
  path: z.string(),
  originalPath: z.string().optional(),
})

export const GitRecentCommitSchema = z.object({
  hash: z.string(),
  subject: z.string(),
  author: z.string(),
  date: z.string(),
})

export const GitStatusSnapshotSchema = z.object({
  repo: z.string(),
  isRepo: z.boolean(),
  branch: z.string(),
  upstream: z.string().optional(),
  ahead: z.number(),
  behind: z.number(),
  clean: z.boolean(),
  changeCount: z.number(),
  counts: z.object({
    conflicted: z.number(),
    staged: z.number(),
    unstaged: z.number(),
    untracked: z.number(),
  }),
  groups: z.object({
    conflicted: z.array(GitFileEntrySchema),
    staged: z.array(GitFileEntrySchema),
    unstaged: z.array(GitFileEntrySchema),
    untracked: z.array(GitFileEntrySchema),
  }),
  recentCommit: GitRecentCommitSchema.optional(),
})

export const PollConfigSchema = z.object({
  refreshIntervalMs: z.number().int(),
})
