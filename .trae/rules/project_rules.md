# Mylo 项目默认开发规范（Trae 执行版）

适用范围：本仓库所有代码与文档（Electron 主进程、React 渲染进程、数据库与工具脚本）。

## 目标
- 保障代码“可运行、可构建、可发布”，并显著提升注释覆盖率与模块内聚性。
- 将高内聚低耦合落到日常开发约束与评审清单，避免随意跨层调用与隐式耦合。

## 执行矩阵（Trae 动作）
- 开发（本地保存或提交前）：
  - 运行：`npm run lint`（通过后由 Trae 自动执行：`npm run build`，无需人工触发）
  - 失败即阻断：语法、类型、构建错误
- 合并前（PR 检查）：
  - 运行：`npm run lint`、`npm test`（如有单测）、`npm run build`
  - 检查：注释覆盖要求（见“注释与文档覆盖”），架构耦合检查清单（见“架构与耦合”）
- 发版前（按平台）：
  - mac：`npm run dist:mac`
  - win：`npm run dist:win`
  - linux：`npm run dist:linux`
  - 说明：本项目使用 `electron-builder`；原生依赖将在打包时源码构建（better-sqlite3）

## 架构与耦合
- 分层与依赖方向（强制）：
  - Renderer（React UI）→ IPC → Main（Electron 主进程）→ Data（SQLite/服务）
  - 禁止 Renderer 直接访问数据库或文件系统；仅通过 `preload.ts` 暴露的 API 与 `ipcMain` 交互（`src/main/preload.ts:161–237`）。
  - Main 模块对外只暴露 IPC 与窗口管理；数据读写封装在服务类（如 `DatabaseService`）。
- 模块边界（强制）：
  - `src/main`：进程控制、窗口、IPC、日志、更新；
  - `src/renderer`：UI、状态与交互；
  - `src/main/database`：数据访问与模型；
  - 新增文件必须放入对应层目录，禁止跨层直接 import。
- 文件与函数规模（建议）：
  - 单文件 ≤ 500 行；函数 ≤ 60 行；圈复杂度适中（拆分私有辅助函数）。
- IPC 设计（强制）：
  - 渠道命名采用动宾结构（如 `get-passwords`、`update-password`），参数与返回值结构固定。
  - 所有新 IPC 必须在 `preload.ts` 暴露一致的签名，并在主进程集中注册。
- 日志与错误（强制）：
  - 主进程初始化日志：`src/main/main.ts:11`；日志落盘：`~/Library/Application Support/Mylo/electron.log`。
  - 不得在日志中打印密钥、原文密码或敏感数据。

## 注释与文档覆盖
- TSDoc/TSDoc 风格注释（强制）覆盖要求：
  - 公共函数、类、导出类型：必须有说明、参数/返回值描述、错误语义；
  - React 组件：说明功能、关键交互、属性含义；
  - IPC 通道：在主进程注册处和 `preload.ts` 暴露处，记录用途与 payload 结构；
  - 数据服务方法：说明事务性、约束与副作用。
- 评审门槛（PR 阶段）：
  - 新增/修改行中，公共接口的注释覆盖率 ≥ 80%；
  - 注释必须与实现一致，不得出现误导或过时文本（参考规则 8）。

## 代码质量与风格
- 命令映射：
  - Lint：`npm run lint`（`package.json:23`）
  - Format：`npm run format`（`package.json:25`）
  - Build：`npm run build`（`package.json:11`）
  - Test：`npm test`（`package.json:21`）
  - Typecheck（建议新增脚本）：`tsc --noEmit`（若脚本不存在，暂不阻断）
- 风格与工具：
  - ESLint + Prettier，统一引号、缩进、行宽；避免 any 与隐式 any。
  - 统一通过 `preload.ts` 暴露 API，避免在 Renderer 直接使用 `ipcRenderer`。

## 安全与数据
- 不提交任何密钥、令牌、用户数据；`.env` 或本地配置不得入库。
- 数据库存放于用户目录：`app.getPath('userData')`，避免写权限问题。
- 敏感字段加密传输与存储，仅在需要时解密；避免日志泄露。

## 发布与自动更新
- 打包：`electron-builder`（配置见 `package.json:84–140`，mac 图标 `package.json:106`）。
- 发布（建议）：
  - 填写 `build.publish` 的 GitHub `owner/repo`，创建发布 Release 与版本标签；
  - 使用 `electron-updater` 自动更新，主进程已集成（`src/main/main.ts:1, 39–46, 98–105` 附近与新增 `setupAutoUpdater`）。

## 目录组织
- 仅在以下目录新增代码：
  - `src/main`（主进程控制、IPC、更新、日志）
  - `src/main/database`（数据访问与模型）
  - `src/renderer`（UI 组件、页面与状态）
  - `assets/icons`（图标资产）

## 评审清单（提交/合并前自检）
- 架构：是否通过 `preload.ts` 暴露接口？是否存在跨层直接 import？
- 注释：公共接口、IPC、组件、服务是否具备充分注释并与代码一致？
- 错误处理：是否捕获并分类错误，是否提供用户可读信息？
- 日志：是否避免敏感信息，是否在关键路径记录状态？
- 规模：是否拆分过长函数或超大文件？
- 构建：`npm run build` 是否成功？

## Trae 助手行为约束（与参考规范一致）
- 复用现有代码与依赖；只在用户明确要求时才新增依赖或重构。
- 只修改被请求的内容；优先确保代码可编译可运行。
- 使用前验证 API 与库是否存在；避免虚构方法与包。
- 修复错误时一次到位，并在交付前验证。

## 变更与维护
- 本规范文件可在需要时更新；修改需遵循最小化原则，并与现有脚本与架构一致。
