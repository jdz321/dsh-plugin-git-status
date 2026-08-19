# 贡献指南

面向开发者的完整说明：架构、构建、挂载、发布。终端用户只需看 [README.zh.md](README.zh.md)。

## 架构

插件是一个 npm 包，内含 Node **host 半** 与浏览器 **client 半**，通过 `cordis.yml`
挂载 —— 与官方 shipped 插件同构。

```
src/
├── index.ts          # GitStatusService（Typert Remote + 工具注册）
├── runner.ts         # 共享 git 执行 + porcelain v1 解析
├── tool.ts           # git_status 模型工具定义
├── types.ts          # 共享 JSON 线缆词汇
└── client/
    ├── index.ts      # apply：$mount contribution + input.right 注册
    ├── gitStatusRemote.ts   # 手写 strict-codec Remote contribution
    └── GitStatusLine.tsx    # 无边框单行组件 + 可展开文件列表
```

### Host 半：无需生成物的 Remote 服务

`GitStatusService extends TypertRemoteService`（`@deepseek-ai/dsh-typert-protocol`）：

- `super(ctx, 'gitStatus')` 绑定 `typertRemote` 服务命名空间
- `@Remote('status')` 标记端点
- Host 端 Typert Gateway 通过 **SRC 反射**（`ctx.reflect.props` +
  `remoteMethods()`）发现服务 —— **不需要 typert 生成物**。推论：`status`
  方法必须使用**简单标识符参数**（不能解构/默认值/rest），因为 SRC 弱解析器
  从源码读取参数名。

`status(cwd)` 通过 `this.ctx.shell` 执行
`git -c core.quotePath=false status --porcelain=v1 -b` 与
`git log -1 --format=%h%x09%s`，解析 porcelain 输出（`src/runner.ts`），返回
结构化的 `GitStatusResult`。失败以 `{ ok: false, error }` 返回 —— **不抛出**，
让浏览器侧渲染错误而非 wire error。

### Client 半：无需改仓库的 Remote

浏览器侧通过 `ctx.remote.$mount(...)` 挂载**手写 `TypertRemoteContribution`**
（`src/client/gitStatusRemote.ts`）。client Gateway 要求 **strict codec**
（`mode: 'strict'` + `schema.parse`）；这里只校验 JSON 边界形状（非空字符串
cwd、对象结果）。两个值得注意的推论：

- **Remote 命名空间方法返回 `RemoteResult` 信封**
  （`{ ok: true, value }` / `{ ok: false, error }`），不是原始业务结果 ——
  `src/client/index.ts` 负责解包。
- 命名空间服务（`remote.gitStatus`）由 `$mount` 自己创建，因此**不能**声明在
  `inject` 里（会在 `apply` 运行前自我等待）；status 注入面先 `await` 挂载，
  再通过 `ctx.get('remote.gitStatus')` 读取。

### Client bundle 契约

`build.mjs` 用 esbuild 产出 `lib/client.js`：

- `format: cjs`、`platform: browser`
- banner/footer 包装成
  `window.__ModuleLoader__.load({ id, factory: (require) => { ... } })`
- **externals** 恰好是 web 平台种子模块（react、react-dom、
  `@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-ui-slots`、
  `@deepseek-ai/dsh-client-web-react`、`@deepseek-ai/dsh-client-ui-primitives`、
  `@deepseek-ai/dsh-client-ui-attachment`、`@deepseek-ai/dsh-client-schema-form`）
  —— ModuleLoader 的 `require` 在运行时回答它们；其余全部内联
- 入口对非平台 `@deepseek-ai/*` 模块只使用 `import type`（类型导入会被擦除，
  不会进入模块表）

### 小部件槽位

`GitStatusLine` 注册在 `conversation.input.right`（id `git-status`、order 0）——
输入工具行、模型选择器之前。它是无边框、单行高度的控件，与工具行风格一致：
分支图标 + 名称、`✓ 干净` 或 `N 个文件有变更`（点击展开浮动分组文件列表，
点击外部收起）、`↻` 刷新。工作区非 git 仓库时整体隐藏，变成仓库后自动恢复。

### 模型工具

`GitStatusService` 在 `Service.init` 里通过 `ctx.get('tools')`（可选 —— tools
缺失时 Remote 面板照常工作）注册 `git_status`。`defineTool` 声明 schema
（`cwd?`）、`json` 输出（`render` 把结构化值 pretty-print 给模型）、`execute`
（失败抛错走标准 `isError` 通道，成功返回 JSON）。agent 调用会写入会话日志并
在轨迹中可见；面板的静默 UI 轮询刻意不写日志。

## 构建

```sh
npm install        # 从 registry 安装全部 devDependencies
npm run build      # tsc → lib/index.js；esbuild → lib/client.js
npm run typecheck  # tsc -p tsconfig.check.json — 全量类型检查
```

- 所有工具与类型依赖（typescript、esbuild、`@deepseek-ai/*` 类型包、
  `@types/react` 等）都是 `devDependency`，通过 registry 正常安装 ——
  没有 symlink、没有检出路径。`build.mjs` 运行本地
  `node_modules/typescript/bin/tsc` 与 `node_modules/esbuild/bin/esbuild`。
- host 源码相对 import 用 `.js` 后缀，保证 tsc 输出是 Node 可运行的 ESM；
  两个检查面：`tsconfig.json`（host 构建）与 `tsconfig.check.json`（整个
  `src`、`noEmit`、`allowImportingTsExtensions`）。

## 挂载机制

本包是 DSH **bundle**：`dsh plugin --profile <name> add dsh-plugin-git-status`
（本地开发用 `file:<检出目录>`）是薄 pnpm 转发器 —— 把包安装进 profile 后，
按安装状态 reconcile `dsh.profile.bundles`：任何 manifest 声明
`dsh.bundle.patch`（本包的 `./cordis.patch.yml`）的依赖都会自动加入 profile
层栈。

1. **Bundle patch** —— `cordis.patch.yml` 插入插件行（`id: git-status`、
   `name: 'dsh-plugin-git-status'`）；该行作为 profile patch 层被应用。
2. **Host 行** —— 该行加载 host 半，同时是 `dsh-client-modules` 扫描读取的
   loader entry。
3. **Client 发现** —— `client-modules` 读取 `dsh.client.platform === 'web'` 与
   `"./client"` export，在 `/plugins/dsh-plugin-git-status/client.js` 提供
   `lib/client.js`，并注入 boot manifest（`window.__DSH_BOOT__`）。
4. **激活** —— 浏览器 loader 用模块表求值 factory；client `apply` 挂载
   Remote 并注册小部件。

任何改动后重启 `dsh web`（bundle rev 在启动时哈希）。

## 测试 / 验证

- porcelain 解析器可独立单测（`src/runner.ts` 的 `parseStatus`）：已用真实
  `git status --porcelain=v1 -b` 输出验证 —— 分支头、`[ahead N, behind M]`、
  `[gone]`、重命名（`old -> new`）、`AM` 双状态。
- 构建后冒烟 host 半：

  ```sh
  node -e "import('dsh-plugin-git-status').then(m => console.log(typeof m.default))"
  ```

- 在真实部署中验证：`git_status` 出现在 `Tool.listTools`，然后在新会话中调用
  并检查轨迹视图。

## 发布

1. 元数据 —— `package.json`（`name`、`version`、`license: MIT`、`files`、
   `exports` `"."` → `lib/index.js` + `lib/index.d.ts`、`"./client"` →
   `lib/client.js`、`dsh.client` manifest、peerDependencies）。
2. 按上文构建并冒烟。
3. `npm pack --dry-run` 检查 tarball，然后 `npm publish --access public`。

## 已知限制

- porcelain 解析器针对 `--porcelain=v1`（非 `-z`）；条目列表上限 500
  （`truncated: true`）；单命令超时 8 秒。
- 工作区环境中需要 `git` 可用。
- 小部件在"非 git 仓库"与缺少 cwd 时隐藏；其它失败（如缺少 `git`）渲染内联错误。
