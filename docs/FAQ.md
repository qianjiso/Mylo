# 1. 白屏
## 问题原因

```
运行环境里全局设置了 ELECTRON_RUN_AS_NODE=1，Electron 会直接以纯 Node 方式启动，require('electron') 只返回可执行文件路径，导致 app 为 undefined，主进程一启动就崩溃，渲染层自然白屏。
```

## 解决方法
- 重新构建主进程：npm run build:main
- 启动：npm start（脚本会自动清理环境变量，即使系统里仍存在 ELECTRON_RUN_AS_NODE 也不再受影响）
- 在当前沙箱中，npm start 已能正常退出 0；本地有图形界面时应能正确弹出应用窗口。（如仍看到白屏，请先确保执行了 npm run build（构建 renderer），或改用 npm run dev 开发模式启动。）


# 2. 渲染层日志调试
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

# 3. 主进程调试
- 构建一次： npm run build
- 启动调试： npm run start:debug
- 打开 Chrome，访问 chrome://inspect → 点击 “Open dedicated DevTools for Node”
- 在 Node DevTools 的 Sources 里直接打开 src/main/database/DatabaseService.ts ，在 1163 行等关键位置设置断点
- 在应用界面执行导入，主进程会在 TS 源上命中断点

# 4. 正确启动方式
- 开发模式（含 DevTools）：ELECTRON_OPEN_DEVTOOLS=1 NODE_ENV=development npm start
- 生产模式（本地文件）：先构建渲染和主进程，再启动
    - 构建： npm run build （等价于依次构建 renderer+main）
    - 启动： npm start
- 如仅执行了 npm run build:main ，请补充执行渲染构建： npm run build:renderer ，再 npm start

# 5. 本地数据库查询
```
cd ~/Library/Application\ Support/Mylo
sqlite3 passwords.db "select * from passwords"
sqlite3 passwords.db "select * from groups"
sqlite3 passwords.db "select * from secure_record_groups"
sqlite3 passwords.db "select * from secure_records"
sqlite3 passwords.db "select * from password_history"
```

# 6.代码执行链路
- 渲染层调用点： src/renderer/App.tsx:216-217 使用 window.electronAPI.addPassword(values)
- 预加载映射： src/main/preload.ts:151-153
    - addPassword: (password) => ipcRenderer.invoke('add-password', password)
- 主进程 IPC 处理： src/main/main.ts:104-108
    - ipcMain.handle('add-password', async (_, password) => { const id = this.databaseService!.savePassword(password); return { success: true, id }; })
- 数据层委派： src/main/database/DatabaseService.ts:648
    - public savePassword(password: PasswordItem): number { return this.passwordService.savePassword(password); }
 - 真实保存逻辑： src/main/services/PasswordService.ts:65-116

# 7.首次初始化项目
```shell
npx electron-builder install-app-deps
```

# 8. MAC崩溃定位分析
## 1.查看系统崩溃报告：
- 打开 Console.app ，定位到 Crash Reports ，查找 Mylo 的条目
- 或在 ~/Library/Logs/DiagnosticReports/ 查找 Mylo_*.crash
## 2.应用日志
- 应用启动日志写入 ~/Library/Application Support/Mylo/electron.log

## 9. 应用数据位置（MAC电脑）
`开发态的数据与应用目录 ~/Library/Application Support/Mylo-dev`
### 数据位置
1. 用户数据目录： ~/Library/Application\ Support/Mylo
    - 数据库文件： ~/Library/Application\ Support/Mylo/passwords.db
    - 日志文件： ~/Library/Application\ Support/Mylo/electron.log
    - 其他设置文件也会在此目录（如 electron-store ）
2. 可能的偏好和状态文件：
    - ~/Library/Preferences/com.yourcompany.mylo.plist
    - ~/Library/Saved\ Application\ State/com.yourcompany.mylo.savedState
    - ~/Library/Caches/Mylo
### 手动清除
1. 关闭应用后执行以下命令清理所有本地数据：
    - 删除用户数据目录： rm -rf ~/Library/Application\ Support/Mylo
    - 删除偏好设置： rm -rf ~/Library/Preferences/com.yourcompany.mylo.plist
    - 删除缓存： rm -rf ~/Library/Caches/Mylo
    - 删除保存的会话状态： rm -rf ~/Library/Saved\ Application\ State/com.yourcompany.mylo.savedState