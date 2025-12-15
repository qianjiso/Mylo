# Repository Guidelines

## 项目结构与模块
- `src/main`：Electron 主进程、IPC、数据库层（`database/`、`repositories/`、`services/`、`preload.ts`、`main.ts`）；加密、文件与 SQLite 写入仅放这里。
- `src/renderer`：React 界面（components、hooks、styles、columns、services、utils）；入口 `index.tsx`，模板 `index.html`。
- `src/shared`、`src/types`：跨进程共享类型，扩展结构优先放这里。
- `docs/`：架构、需求、设计文档；平台行为变更时同步更新。
- `scripts/`：运行 Electron 的辅助脚本；调整启动流程前先看此目录。
- `dist/`、`release/`：构建与发行产物，勿手改。

## 构建、测试与开发命令
- `npm run dev`：并发启动渲染端 dev-server 与主进程 watch。
- `npm start`：指向本地 dev 资源启动 Electron。
- `npm run build`（或 `build:renderer`、`build:main`）：生成生产包。
- `npm run dist`、`dist:mac|win|linux`：electron-builder 生成平台安装包。
- `npm run test` / `test:watch`：Jest + ts-jest（jsdom 环境）。
- `npm run lint`、`lint:fix`、`npm run format`：ESLint + Prettier 规范与修复。
- 在执行 `npm run lint` 与 `npm run build` 前，可先运行 `nvm use 20` 确认 Node 版本一致。
- 完成任务后需执行 `npm run lint` 与 `npm run build` 并修复出现的问题再交付。
 - 代理在对仓库进行任何代码修改（即使用 `apply_patch` 实际变更文件）后，必须在结束回复前执行一次 `npm run lint && npm run build`，并在最终回复中简要说明执行结果。

## 代码风格与命名
- TypeScript 默认；2 空格缩进，单引号，必要时尾随逗号。提交前跑 `npm run lint` 和 `npm run format`。
- React 使用函数式组件 + hooks；组件文件 PascalCase，工具/Hook 文件 camelCase（如 `usePasswords.ts`），CSS 使用 kebab-case。
- IPC 边界：渲染层仅调用 `preload.ts` 暴露的 `window.electronAPI`；禁止在渲染层直接引入 Node API。
- 加密与数据库写操作只放在 `src/main`，渲染层不保存密钥。
- 类型放在 `src/shared` / `src/types`，避免在主/渲染重复声明。

## 测试指引
- 测试放在 `src/**/__tests__` 或 `*.test.ts(x)`；优先编写可在 jsdom 跑的组件测试与带 mock 的服务/IPC 契约测试。
- 默认覆盖率排除 `src/main`，但关键主进程逻辑仍需定向测试，可用 mock 或集成替身。
- 提供示例密码/分组夹具，渲染层测试时 stub `window.electronAPI`。
- 变更 Jest 配置或全局 setup 时同步检查 `src/setupTests.ts` 兼容性。

## 提交与合并请求
- 使用约定式前缀 + 范围，例如 `feat(密码管理): ...`、`chore: ...`；动词保持祈使、简短，中文 scope 可接受。
- PR 需包含变更摘要、关联 issue（如有）、可见界面改动的截图/GIF，以及安全或存储影响说明；注明已执行的测试/规范命令。

## 安全与配置提示
- 开启 `contextIsolation`，保持 `nodeIntegration` 关闭；仅暴露最小化 preload API。
- 校验所有 IPC 入参并清理 SQL；避免日志中出现敏感信息。
- 持久化结构调整时同步更新 `src/main/database` 迁移并在 `docs/` 记录。
- 版本发布前自查依赖许可与 electron-builder 配置（appId、图标、发布渠道）。 
