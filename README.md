# dsh-plugin-git-status

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that
shows the git status of the current workspace. It is **read-only**: it never
creates, modifies, or deletes any file.

- **Git status panel** — a small chip in the composer tool row, to the left of
  the model selector. It shows the branch name, a clean/dirty summary, and a
  manual refresh button. When the working tree has changes, the change count is
  clickable and expands into a grouped file list (conflicted / staged /
  unstaged / untracked) with porcelain status codes and rename origins. The
  panel refreshes every 30 seconds and hides entirely when the workspace is not
  a git repository.
- **`git_status` model tool** — callable through the normal tool pipeline.
  Returns structured JSON with the branch, commits ahead/behind upstream,
  grouped change counts, the file list, and the most recent commit. It accepts
  an optional `cwd`; when omitted it inspects the current session workspace.

## Screenshots

Clean workspace — the chip shows the branch and a green "✓ clean" summary:

![Clean workspace](assets/clean.png)

Workspace with changes — the change count is a clickable text that opens the
grouped file list:

![Workspace with changes](assets/changes.png)

Workspace with changes, file list expanded — grouped by conflicted / staged /
unstaged / untracked; each row shows the porcelain status code, the path, and
the original path for renames:

![Workspace with changes, file list expanded](assets/changes-expanded.png)

## Supported Harness version

`0.1.0-rc.7` (the plugin peer-depends on the same `@deepseek-ai/*` package
versions).

## Install

```bash
dsh plugin --profile <name> add dsh-plugin-git-status
```

If the CLI is not installed globally:

```bash
npx @deepseek-ai/dsh plugin --profile <name> add dsh-plugin-git-status
```

Replace `<name>` with your profile name (e.g. `web`). Restart the Harness
process after installing, then hard-refresh the browser page.

For a reproducible install, pin a commit (replace the example with the real
commit SHA):

```bash
dsh plugin --profile <name> add github:<owner>/dsh-plugin-git-status#0123456789abcdef0123456789abcdef
```

## Update / remove

Use the CLI's update and remove commands:

```bash
dsh plugin --profile <name> remove dsh-plugin-git-status
dsh plugin --profile <name> add dsh-plugin-git-status
```

## Data storage

The plugin stores nothing. Git status is computed on demand by running
read-only `git status` / `git log` commands in the inspected directory.

## Known limitations

- The panel is session-scoped and reflects the active session's workspace. If
  the session has no workspace directory, the panel is not shown.
- Paths with two or more consecutive spaces are read from `git status -z`, so
  they are preserved exactly.
- The panel does not offer inline file operations; it only reports status.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` emits `lib/index.js` (Host), `lib/typert.js` (Remote descriptor),
and `lib/client.js` (browser bundle).
