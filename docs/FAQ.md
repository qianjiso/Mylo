# 1. 白屏
## 问题原因

```
运行环境里全局设置了 ELECTRON_RUN_AS_NODE=1，Electron 会直接以纯 Node 方式启动，require('electron') 只返回可执行文件路径，导致 app 为 undefined，主进程一启动就崩溃，渲染层自然白屏。
```

## 解决方法
- 重新构建主进程：npm run build:main
- 启动：npm start（脚本会自动清理环境变量，即使系统里仍存在 ELECTRON_RUN_AS_NODE 也不再受影响）
- 在当前沙箱中，npm start 已能正常退出 0；本地有图形界面时应能正确弹出应用窗口。（如仍看到白屏，请先确保执行了 npm run build（构建 renderer），或改用 npm run dev 开发模式启动。）


# 2. 运行时日志调试
- 启动步骤
    - 安装依赖：在项目目录运行 npm install
    - 启动开发服务：开一个终端运行 npm run dev ，等待提示监听在 http://localhost:3000
    - 启动 Electron：再开一个终端运行 NODE_ENV=development npm start ，应用窗口会启动
- 打开开发者工具
    - 开发模式自动打开：主进程代码在 src/main/main.ts:80 调用 this.mainWindow.webContents.openDevTools() ，正常会自动弹出
    - 手动快捷键（macOS）：在应用窗口按 Cmd + Option + I
    - 菜单操作：菜单栏选择 “视图(View) -> 切换开发者工具(Toggle Developer Tools)”
查看日志
    - 切到 DevTools 的 Console 面板

# 3. 正确启动方式
- 开发模式（含 DevTools）： NODE_ENV=development npm start
- 生产模式（本地文件）：先构建渲染和主进程，再启动
    - 构建： npm run build （等价于依次构建 renderer+main）
    - 启动： npm start
- 如仅执行了 npm run build:main ，请补充执行渲染构建： npm run build:renderer ，再 npm start

# 4. 本地数据库查询
```
sqlite3 passwords.db "select * from passwords"
```

# 5.代码执行链路
- 渲染层调用点： src/renderer/App.tsx:216-217 使用 window.electronAPI.addPassword(values)
- 预加载映射： src/main/preload.ts:151-153
    - addPassword: (password) => ipcRenderer.invoke('add-password', password)
- 主进程 IPC 处理： src/main/main.ts:104-108
    - ipcMain.handle('add-password', async (_, password) => { const id = this.databaseService!.savePassword(password); return { success: true, id }; })
- 数据层委派： src/main/database/DatabaseService.ts:648
    - public savePassword(password: PasswordItem): number { return this.passwordService.savePassword(password); }
 - 真实保存逻辑： src/main/services/PasswordService.ts:65-116

# 6. 关于“便笺”（原“加密笔记”）
## 为什么移除多账号密码？
- 单条目包含多个账号会导致自动填充、健康评分、泄露检测、权限审计变得复杂且不一致。
- 统一“一账号=一条目”更清晰，便于后续功能扩展与维护。

## “便笺”是什么？
- 独立的自由文本记录模块，支持分组、置顶、归档；内容端侧加密，服务端不可读。
- 与密码模块彻底解耦；适合记录账号列表、操作说明、临时信息等。

## 命名为什么叫“安全记录”？
- 简洁直观，强调安全属性与记录功能，比“加密笔记”更口语化、易理解。

## 如何迁移历史“多账号”内容？
- 旧版本中的多账号文本可一键转换为“便笺”；如需拆分为多个单账号密码，可由迁移向导尝试解析，失败项保留至“便笺”。

## 搜索如何工作？
- 密码：基于数据库 FTS5（title/username/url/notes）。
- 便笺：客户端解密后本地搜索，保护隐私。
