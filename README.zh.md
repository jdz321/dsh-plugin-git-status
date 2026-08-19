# dsh-plugin-git-status

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH)
插件：把当前工作区的 Git 状态放在 Web 界面触手可及的位置 —— 输入框工具行、
模型选择器左侧的一行摘要，外加一个 agent 可以调用的 `git_status` 工具。

## 功能

### 输入工具行里的 Git 状态

一个紧凑、无边框的小部件，位于输入框工具行、模型选择器之前 —— 只要会话打开就可见：

```
[lucide git 图标] master   ✓ 干净   ↻
```

- **分支** —— 当前工作区的分支名，带 git 分支图标
- **干净** —— 没有待提交变更时显示 `✓ 干净`
- **有变更** —— 显示 `N 个文件有变更`；点击展开浮动的分组文件列表
  （冲突 / 已暂存 / 未暂存 / 未跟踪），带 porcelain 状态字母与重命名原路径；
  点击外部任意位置收起
- **冲突** —— 存在合并冲突时显示红色 `冲突 N`
- **刷新** —— `↻` 按钮手动刷新；同时每 30 秒自动刷新
- **非 git 仓库？** —— 小部件整体隐藏，目录变成仓库后自动恢复显示

小部件只读：只执行 `git status` 与 `git log`，从不改动任何东西。

### `git_status` agent 工具

插件注册了 `git_status` 工具，agent 可通过常规工具管线调用 —— 例如你问
"当前仓库状态如何？"时，模型调用它并拿到结构化答案：

- 返回 **JSON**（分支、相对上游领先/落后、分组计数、文件列表、最近提交）
- 可选参数 `cwd`（省略时用当前会话工作区）
- agent 的调用会写入会话日志，并在**轨迹**视图中作为普通工具操作展示

## 安装

需要具备 `shell` 服务（bash 执行器）的 DSH Web 部署，且工作区环境中可用 `git`。
本包是 DSH **bundle**：`dsh plugin add` 安装后会自动挂载插件行（无需手动编辑
cordis.yml）。

```sh
dsh plugin --profile web add dsh-plugin-git-status
```

然后重启 `dsh web`。完成 —— 小部件出现在输入工具行，`git_status` 对 agent 可用。

> 本地开发：用 `dsh plugin --profile web add file:<包目录>` 代替 npm 包名安装；
> `npm run build` 后重新执行即可（bundle 从安装位置解析）。

完成 —— 小部件出现在输入工具行，`git_status` 对 agent 可用。

## 使用

- **查看状态** —— 看模型选择器左侧的工具行
- **查看变更** —— 点击 `N 个文件有变更` 展开文件列表，点击外部收起
- **让 agent 查询** —— 在会话中问，如"当前仓库的 git 状态如何？"；
  agent 会调用 `git_status`，可在轨迹视图中查看这次调用

## 环境要求

- Node >= 22.19（构建需要）
- 工作区环境中可用 `git` 的 DSH Web 部署

## License

MIT

---

开发者文档（架构、构建、挂载机制、发布）见 [CONTRIBUTING.zh.md](CONTRIBUTING.zh.md)。
