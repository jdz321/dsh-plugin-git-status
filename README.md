# dsh-plugin-git-status

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH)
plugin that puts your workspace's Git status at your fingertips in the Web
GUI: a one-line summary right next to the model selector, plus a `git_status`
tool your agent can call.

## Features

### Git status in the composer tool row

A compact, borderless widget sits in the input row, just before the model
selector — visible whenever you have a session open:

```
[lucide git icon] master   ✓ 干净   ↻
```

- **Branch** — current branch of the workspace, with a git-branch icon
- **Clean** — `✓ 干净` when there is nothing to commit
- **Dirty** — `N 个文件有变更`; click it to expand a floating, grouped file
  list (冲突 / 已暂存 / 未暂存 / 未跟踪) with porcelain status letters and
  rename origins; click anywhere outside to close
- **Conflicts** — a red `冲突 N` hint when merge conflicts exist
- **Refresh** — the `↻` button refreshes on demand; the widget also
  auto-refreshes every 30 seconds
- **Not a git repository?** — the widget hides itself entirely; it reappears
  automatically once the directory becomes a repo

The widget is read-only: it runs `git status` and `git log`, never mutates
anything.

### `git_status` agent tool

The plugin registers a `git_status` tool your agent can call through the normal
tool pipeline — useful when you ask "what's the state of this repo?" and want a
structured answer:

- Returns the status as **JSON** (branch, ahead/behind, per-group counts, file
  list, last commit)
- Takes an optional `cwd` (defaults to the session workspace)
- Agent calls land in the session log and the **trajectory view** as normal
  tool operations

## Install

Requires a DSH Web deployment with the `shell` service (bash executor) and
`git` available in the workspace environment. The package is a DSH **bundle**:
`dsh plugin add` installs it and automatically mounts the plugin row (no manual
cordis.yml editing).

```sh
dsh plugin --profile web add dsh-plugin-git-status
```

Then restart `dsh web`. Done — the widget appears in the composer tool row and
`git_status` becomes available to agents.

> Local development: install from a checkout with
> `dsh plugin --profile web add file:<path-to-package>` instead of the npm
> name; re-run after `npm run build` (bundles are resolved from the installed
> location).

## Use

- **See the state** — look at the tool row next to the model selector
- **Inspect changes** — click `N 个文件有变更` to expand the file list, click
  outside to collapse
- **Ask the agent** — in a session, ask e.g. "当前仓库的 git 状态如何？"; the
  agent calls `git_status` and you can review the call in the trajectory view

## Requirements

- Node >= 22.19 (to build)
- A DSH Web deployment with `git` on PATH in the workspace environment

## License

MIT

---

Developer documentation (architecture, building, mounting mechanics,
publishing) lives in [CONTRIBUTING.md](CONTRIBUTING.md).
