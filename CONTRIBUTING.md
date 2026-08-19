# Contributing

Everything a developer needs to understand, build, mount, and publish
`dsh-plugin-git-status`. End users only need [README.md](README.md).

## Architecture

The plugin is one npm package with a Node **host half** and a browser
**client half**, mounted through `cordis.yml` — the same shape as the shipped
harness plugins.

```
src/
├── index.ts          # GitStatusService (Typert Remote + tool registration)
├── runner.ts         # shared git runner + porcelain v1 parser
├── tool.ts           # git_status model tool definition
├── types.ts          # shared JSON wire vocabulary
└── client/
    ├── index.ts      # apply: $mount contribution + input.right registration
    ├── gitStatusRemote.ts   # hand-written strict-codec Remote contribution
    └── GitStatusLine.tsx    # borderless one-line widget + expandable file list
```

### Host half: Remote service without generated artifacts

`GitStatusService extends TypertRemoteService` (`@deepseek-ai/dsh-typert-protocol`):

- `super(ctx, 'gitStatus')` binds the `typertRemote` service namespace
- `@Remote('status')` marks the endpoint
- The Host Typert Gateway discovers the service through **SRC reflection**
  over `ctx.reflect.props` + `remoteMethods()` — no typert-generated registry
  artifact is needed. Consequence: the `status` method must keep **simple
  identifier parameters** (no destructuring/defaults/rest), because the SRC
  weak parser reads parameter names from the source.

`status(cwd)` runs `git -c core.quotePath=false status --porcelain=v1 -b` and
`git log -1 --format=%h%x09%s` through `this.ctx.shell`, parses the porcelain
output (`src/runner.ts`), and returns a structured `GitStatusResult`. Failures
are returned as `{ ok: false, error }` — never thrown — so the browser renders
them instead of a wire error.

### Client half: Remote without repo changes

The browser mounts a **hand-written `TypertRemoteContribution`**
(`src/client/gitStatusRemote.ts`) via `ctx.remote.$mount(...)`. The client
Gateway requires **strict codecs** (`mode: 'strict'` with a `schema.parse`);
the schemas here only check the JSON boundary shape (a non-empty string cwd,
an object result). Two consequences worth knowing:

- **Remote namespace methods return a `RemoteResult` envelope**
  (`{ ok: true, value }` / `{ ok: false, error }`), not the raw business
  result — `src/client/index.ts` unwraps it.
- The namespace service (`remote.gitStatus`) is created by `$mount` itself, so
  it must NOT be declared in `inject` (that would self-wait before `apply`
  runs); the status face awaits the mount, then reads it via `ctx.get('remote.gitStatus')`.

### Client bundle contract

`build.mjs` emits `lib/client.js` with esbuild:

- `format: cjs`, `platform: browser`;
- banner/footer wrap the output in
  `window.__ModuleLoader__.load({ id, factory: (require) => { ... } })`;
- **externals** are exactly the web platform seed modules (react, react-dom,
  `@deepseek-ai/cordis`, `@deepseek-ai/dsh-client-ui-slots`,
  `@deepseek-ai/dsh-client-web-react`, `@deepseek-ai/dsh-client-ui-primitives`,
  `@deepseek-ai/dsh-client-ui-attachment`,
  `@deepseek-ai/dsh-client-schema-form`) — the ModuleLoader's `require` answers
  these at runtime; everything else is inlined.
- The entry uses only `import type` for non-platform `@deepseek-ai/*` modules
  (type-only imports are erased and never reach the module table).

### The widget slot

`GitStatusLine` registers into `conversation.input.right` (id `git-status`,
order 0) — the composer tool row, right before the model selector. It is a
borderless, one-row-height widget matching the tool-row controls: branch icon +
name, `✓ 干净` or `N 个文件有变更` (click toggles a floating grouped file
list; click-outside closes), and a `↻` refresh. It hides entirely when the
workspace is not a git repository, and re-appears once it is.

### The model tool

`GitStatusService` registers `git_status` in `Service.init` via
`ctx.get('tools')` (optional — Remote still works without the tools registry).
`defineTool` declares the schema (`cwd?`), a `json` output whose `render`
pretty-prints the structured value for the model, and `execute` which throws on
failure (standard `isError` channel) and returns the JSON status otherwise.
Agent calls are session-logged and trajectory-visible; the widget's silent UI
polling deliberately is not.

## Build

```sh
npm install        # registry install of all devDependencies
npm run build      # tsc → lib/index.js; esbuild → lib/client.js
npm run typecheck  # tsc -p tsconfig.check.json — full src typecheck
```

- Every tool and type dependency (typescript, esbuild, `@deepseek-ai/*` type
  packages, `@types/react`, ...) is a `devDependency` resolved through the
  registry — no symlinks, no checkout paths. `build.mjs` runs the local
  `node_modules/typescript/bin/tsc` and `node_modules/esbuild/bin/esbuild`.
- Host sources use `.js` import suffixes so the tsc output is Node-runnable
  ESM; `tsconfig.json` (host build) and `tsconfig.check.json` (whole `src`,
  `noEmit`, `allowImportingTsExtensions`) are the two check surfaces.

## Mounting mechanics

The package is a DSH **bundle**: `dsh plugin --profile <name> add
dsh-plugin-git-status` (or `file:<checkout>` for local dev) is a thin pnpm
forwarder — it installs the package into the profile, then reconciles
`dsh.profile.bundles` by installed state: any dependency whose manifest
declares `dsh.bundle.patch` (this package's `./cordis.patch.yml`) joins the
profile's layer stack automatically.

1. **Bundle patch** — `cordis.patch.yml` inserts the plugin row
   (`id: git-status`, `name: 'dsh-plugin-git-status'`); the row is applied as
   a profile patch layer.
2. **Host row** — the row loads the host half and is simultaneously the loader
   entry the `dsh-client-modules` scan reads.
3. **Client discovery** — `client-modules` reads `dsh.client.platform ===
   'web'` and the `"./client"` export, serves `lib/client.js` at
   `/plugins/dsh-plugin-git-status/client.js`, and injects the boot manifest
   (`window.__DSH_BOOT__`).
4. **Activation** — the browser loader evaluates the factory with its module
   table; the client `apply` mounts the Remote and registers the widget.

Restart `dsh web` after any change (bundle revs are hashed at startup).

## Testing / verification

- The porcelain parser is unit-testable in isolation
  (`parseStatus` in `src/runner.ts`): exercised against realistic
  `git status --porcelain=v1 -b` output — branch headers, `[ahead N, behind M]`,
  `[gone]`, renames (`old -> new`), `AM` double states.
- Smoke the host half after building:

  ```sh
  node -e "import('dsh-plugin-git-status').then(m => console.log(typeof m.default))"
  ```

- In a live deployment, verify `git_status` appears in `Tool.listTools`, then
  call it from a fresh session and inspect the trajectory view.

## Publishing

1. Metadata — `package.json` (`name`, `version`, `license: MIT`, `files`,
   `exports` `"."` → `lib/index.js` + `lib/index.d.ts`, `"./client"` →
   `lib/client.js`, `dsh.client` manifest, peerDependencies).
2. Build and smoke as above.
3. `npm pack --dry-run` to inspect the tarball, then `npm publish --access public`.

## Known limitations

- The porcelain parser targets `--porcelain=v1` (not `-z`); entry lists cap at
  500 (`truncated: true`); per-command timeout is 8 s.
- Requires `git` on PATH in the workspace environment.
- The widget hides on "not a git repository" and on missing cwd; other failures
  (e.g. missing `git`) render an inline error.
