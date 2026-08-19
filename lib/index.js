import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { execFile } from "node:child_process";
//#region src/git.ts
/**
* Read-only git inspection: `git status` / `git log` executed through
* `child_process.execFile` (argument list, never a shell). Every command is a
* read-only query; this module never mutates the repository.
*/
/** Unmerged (conflicted) porcelain `XY` codes. */
const UNMERGED_CODES = /* @__PURE__ */ new Set([
	"DD",
	"AU",
	"UD",
	"UA",
	"DU",
	"AA",
	"UU"
]);
const NOT_A_REPO_PATTERN = /not a git repository/i;
function isGitError(error) {
	return error instanceof Error && "notRepo" in error;
}
/** A `GitStatusSnapshot` for a directory that is not a git repository. */
function emptyStatus(repo) {
	return {
		repo,
		isRepo: false,
		branch: "",
		ahead: 0,
		behind: 0,
		clean: true,
		changeCount: 0,
		counts: {
			conflicted: 0,
			staged: 0,
			unstaged: 0,
			untracked: 0
		},
		groups: {
			conflicted: [],
			staged: [],
			unstaged: [],
			untracked: []
		}
	};
}
/** Run one git command and resolve with its trimmed stdout. */
function runGit(cwd, args) {
	return new Promise((resolve, reject) => {
		execFile("git", args, {
			cwd,
			maxBuffer: 16777216
		}, (error, stdout, stderr) => {
			if (error) {
				const message = (stderr ?? "").trim() || error.message;
				const notRepo = NOT_A_REPO_PATTERN.test(stderr ?? "") || NOT_A_REPO_PATTERN.test(error.message);
				const wrapped = new Error(message);
				wrapped.exitCode = typeof error.code === "number" ? error.code : void 0;
				wrapped.notRepo = notRepo;
				reject(wrapped);
				return;
			}
			resolve(stdout);
		});
	});
}
/** Parse `# branch.*` headers from `git status --porcelain=v2 --branch`. */
function parseBranchInfo(output) {
	let branch = "";
	let upstream;
	let ahead = 0;
	let behind = 0;
	for (const line of output.split("\n")) if (line.startsWith("# branch.head ")) branch = line.slice(14).trim();
	else if (line.startsWith("# branch.upstream ")) upstream = line.slice(18).trim();
	else if (line.startsWith("# branch.ab ")) {
		const match = line.slice(12).trim().match(/^\+(\d+) -(\d+)$/);
		if (match !== null) {
			ahead = Number(match[1]);
			behind = Number(match[2]);
		}
	}
	return {
		branch,
		upstream,
		ahead,
		behind
	};
}
/** Parse `git status --porcelain=v1 -z` into grouped file entries. */
function parseFileEntries(output) {
	const conflicted = [];
	const staged = [];
	const unstaged = [];
	const untracked = [];
	const records = output.split("\0");
	for (let index = 0; index < records.length; index += 1) {
		const record = records[index];
		if (record === void 0 || record === "") continue;
		const status = record.slice(0, 2);
		const path = record.slice(3);
		if (status === "??") {
			untracked.push({
				status,
				path
			});
			continue;
		}
		if (status[0] === "R" || status[0] === "C") {
			const originalPath = records[index + 1];
			if (originalPath !== void 0 && originalPath !== "") {
				staged.push({
					status,
					path,
					originalPath
				});
				index += 1;
			} else staged.push({
				status,
				path
			});
			continue;
		}
		if (UNMERGED_CODES.has(status)) {
			conflicted.push({
				status,
				path
			});
			continue;
		}
		const indexStatus = status[0] ?? " ";
		const worktreeStatus = status[1] ?? " ";
		if (indexStatus !== " ") staged.push({
			status,
			path
		});
		if (worktreeStatus !== " ") unstaged.push({
			status,
			path
		});
	}
	return {
		conflicted,
		staged,
		unstaged,
		untracked
	};
}
/** Parse `git log -1 --format=%H%x00%an%x00%aI%x00%s` into a commit view. */
function parseRecentCommit(output) {
	const fields = output.trim().split("\0");
	if (fields.length < 4 || fields[0] === "") return void 0;
	return {
		hash: fields[0] ?? "",
		author: fields[1] ?? "",
		date: fields[2] ?? "",
		subject: fields.slice(3).join("\0") ?? ""
	};
}
/** Resolve a cwd that is empty/undefined to the process working directory. */
function resolveCwd(cwd) {
	return cwd === void 0 || cwd.trim() === "" ? process.cwd() : cwd;
}
/** Inspect the git status of one directory. Never mutates the repository. */
async function runGitStatus(cwd) {
	const repo = resolveCwd(cwd);
	const base = emptyStatus(repo);
	let branchOut;
	let filesOut;
	let logOut;
	try {
		branchOut = await runGit(repo, [
			"status",
			"--porcelain=v2",
			"--branch"
		]);
		filesOut = await runGit(repo, [
			"status",
			"--porcelain=v1",
			"-z"
		]);
	} catch (error) {
		if (isGitError(error) && error.notRepo) return base;
		throw error;
	}
	const branch = parseBranchInfo(branchOut);
	const groups = parseFileEntries(filesOut);
	const changedPaths = /* @__PURE__ */ new Set();
	for (const entry of [
		...groups.conflicted,
		...groups.staged,
		...groups.unstaged,
		...groups.untracked
	]) changedPaths.add(entry.path);
	const changeCount = changedPaths.size;
	try {
		logOut = await runGit(repo, [
			"log",
			"-1",
			"--format=%H%x00%an%x00%aI%x00%s"
		]);
	} catch {
		logOut = void 0;
	}
	const recentCommit = logOut === void 0 ? void 0 : parseRecentCommit(logOut);
	const upstream = branch.upstream !== void 0 && branch.upstream !== "" ? branch.upstream : void 0;
	return {
		repo,
		isRepo: true,
		branch: branch.branch === "" ? "(detached)" : branch.branch,
		...upstream !== void 0 ? { upstream } : {},
		ahead: branch.ahead,
		behind: branch.behind,
		clean: changeCount === 0,
		changeCount,
		counts: {
			conflicted: groups.conflicted.length,
			staged: groups.staged.length,
			unstaged: groups.unstaged.length,
			untracked: groups.untracked.length
		},
		groups,
		...recentCommit !== void 0 ? { recentCommit } : {}
	};
}
//#endregion
//#region src/index.ts
const name = "dsh-plugin-git-status";
const inject = ["tools"];
const FILE_ENTRY_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		status: {
			type: "string",
			required: true
		},
		path: {
			type: "string",
			required: true
		},
		originalPath: { type: "string" }
	}
};
const GIT_STATUS_OUTPUT_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		repo: {
			type: "string",
			required: true
		},
		isRepo: {
			type: "boolean",
			required: true
		},
		branch: {
			type: "string",
			required: true
		},
		upstream: { type: "string" },
		ahead: {
			type: "integer",
			required: true
		},
		behind: {
			type: "integer",
			required: true
		},
		clean: {
			type: "boolean",
			required: true
		},
		changeCount: {
			type: "integer",
			required: true
		},
		counts: {
			type: "object",
			additionalProperties: false,
			required: true,
			properties: {
				conflicted: {
					type: "integer",
					required: true
				},
				staged: {
					type: "integer",
					required: true
				},
				unstaged: {
					type: "integer",
					required: true
				},
				untracked: {
					type: "integer",
					required: true
				}
			}
		},
		groups: {
			type: "object",
			additionalProperties: false,
			required: true,
			properties: {
				conflicted: {
					type: "array",
					items: FILE_ENTRY_SCHEMA,
					required: true
				},
				staged: {
					type: "array",
					items: FILE_ENTRY_SCHEMA,
					required: true
				},
				unstaged: {
					type: "array",
					items: FILE_ENTRY_SCHEMA,
					required: true
				},
				untracked: {
					type: "array",
					items: FILE_ENTRY_SCHEMA,
					required: true
				}
			}
		},
		recentCommit: {
			type: "object",
			additionalProperties: false,
			properties: {
				hash: {
					type: "string",
					required: true
				},
				subject: {
					type: "string",
					required: true
				},
				author: {
					type: "string",
					required: true
				},
				date: {
					type: "string",
					required: true
				}
			}
		}
	}
};
const TOOL_DESCRIPTION = "Read the git status of a working directory without modifying anything. Returns structured JSON with the current branch, commits ahead/behind its upstream, grouped change counts (conflicted / staged / unstaged / untracked), the changed file list with porcelain status codes (renames include their original path), and the most recent commit. Pass `cwd` to inspect a specific directory; omit it to inspect the current session workspace.";
/** Remote service consumed by the browser panel. */
var GitStatusService = class extends TypertRemoteService {
	constructor(ctx) {
		super(ctx, "gitStatus");
	}
	/** Inspect the git status of one directory (defaults to the host cwd). */
	async status(cwd) {
		return runGitStatus(cwd);
	}
};
function apply(ctx) {
	ctx.plugin(GitStatusService);
	ctx.tools.register(defineTool({
		name: "git_status",
		description: TOOL_DESCRIPTION,
		parameters: { cwd: {
			type: "string",
			description: "Optional absolute path to inspect. Omit to use the current session workspace."
		} },
		output: {
			schema: GIT_STATUS_OUTPUT_SCHEMA,
			render: (_args, value) => [{
				type: "text",
				text: JSON.stringify(value)
			}]
		},
		execute(args, exec) {
			const cwd = args.cwd ?? exec.agent?.session.header.cwd;
			return Promise.resolve(runGitStatus(cwd));
		},
		presentCall: (args) => ({
			card: "generic",
			title: "Git status",
			kind: "read",
			...args.cwd !== void 0 ? { rawInput: args.cwd } : {}
		})
	}));
}
//#endregion
export { GitStatusService, apply, inject, name };
