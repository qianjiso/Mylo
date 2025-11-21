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