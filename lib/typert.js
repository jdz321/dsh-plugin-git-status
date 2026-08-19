import { z } from "zod";
//#region src/schema.ts
/** Zod v4 schemas shared by the Host `TYPERT` and Client `TYPERT_REMOTE` codecs. */
const GitFileEntrySchema = z.object({
	status: z.string(),
	path: z.string(),
	originalPath: z.string().optional()
});
const GitRecentCommitSchema = z.object({
	hash: z.string(),
	subject: z.string(),
	author: z.string(),
	date: z.string()
});
const GitStatusSnapshotSchema = z.object({
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
		untracked: z.number()
	}),
	groups: z.object({
		conflicted: z.array(GitFileEntrySchema),
		staged: z.array(GitFileEntrySchema),
		unstaged: z.array(GitFileEntrySchema),
		untracked: z.array(GitFileEntrySchema)
	}),
	recentCommit: GitRecentCommitSchema.optional()
});
//#endregion
//#region src/typert.ts
/**
* Host `TYPERT` manifest. The Harness typert-loader imports this module (via
* the package `./typert` export) when the plugin mounts and registers the
* strict invocation descriptor, so the Gateway can resolve `gitStatus/status`
* without falling back to source parsing.
*/
const TYPERT = {
	package: "dsh-plugin-git-status",
	face: "host",
	schemas: [],
	invocations: [{
		id: "dsh-plugin-git-status#gitStatus/status",
		service: "gitStatus",
		namespace: "gitStatus",
		method: "status",
		invocation: { kind: "direct" },
		parameters: [{
			name: "cwd",
			wire: "cwd",
			source: "json",
			acceptsUndefined: true,
			codec: {
				mode: "strict",
				typeSymbol: "dsh-plugin-git-status/types#CwdArg",
				schema: z.string().optional()
			}
		}],
		result: {
			mode: "strict",
			typeSymbol: "dsh-plugin-git-status/types#GitStatusSnapshot",
			schema: GitStatusSnapshotSchema
		},
		sourceLocation: {
			file: "src/index.ts",
			line: 1,
			column: 1
		}
	}],
	model: {
		services: [],
		events: [],
		objects: []
	}
};
//#endregion
export { TYPERT, TYPERT as default };
