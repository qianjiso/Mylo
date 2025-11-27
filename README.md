# 密码管理器 (Password Manager)

一个基于 Electron + React + TypeScript 的本地密码管理应用，提供安全的密码存储、分组管理、历史记录、搜索以及导入导出功能。

## 🚀 项目特性

- 🔒 安全加密：AES-256-CBC + PBKDF2（10000次）加密敏感字段
- 🖥️ 桌面应用：Electron 主进程 + React 渲染进程
- 🌐 本地优先：数据仅存储在本地 SQLite（better-sqlite3）
- 🔎 全文搜索：SQLite FTS5 同步索引（title/username/url/notes）
- 🧩 分组管理：树形分组、颜色标识、唯一性校验
- 📝 历史记录：密码变更自动记录，历史查看支持隐私显示
- 📤 导入导出：JSON/CSV 导出；JSON/CSV 导入与数据完整性验证
- 🎲 密码生成：可配置长度与字符集，支持一键生成与复制

## 📋 系统要求

- 操作系统: macOS 12+, Windows 10+, Ubuntu 20.04+
- Node.js: 18+
- 磁盘空间: 200MB+

## 🛠️ 技术栈

- Electron 27.x（主进程、IPC）
- React 18 + TypeScript 5（渲染进程 UI）
- Ant Design 5（组件库）
- SQLite + better-sqlite3（本地持久化）
- Node.js crypto（PBKDF2 与 AES-256-CBC）
- Webpack 5（主/渲染构建与开发服务器）
- Jest（测试），ESLint + Prettier（代码规范）

## 📁 项目结构

```
mima_package/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── database/            # DatabaseService 等
│   │   ├── services/            # Group/Password/Settings 服务
│   │   ├── repositories/        # 访问层（如 groups/passwords）
│   │   ├── main.ts              # 主进程入口与 IPC handlers
│   │   └── preload.ts           # 预加载桥接
│   ├── renderer/                # 渲染进程 (React)
│   │   ├── components/          # UI 组件（生成器/设置/导入导出等）
│   │   ├── utils/               # 通用工具
│   │   ├── styles/              # 样式
│   │   ├── index.html           # 页面模板
│   │   ├── index.tsx            # React 入口
│   │   └── App.tsx              # 主界面
│   └── shared/security/crypto.ts# 加密适配器
├── docs/                        # 项目文档
├── scripts/start-electron.js    # 启动 Electron 脚本
├── webpack.main.config.js       # 主进程构建配置
├── webpack.renderer.config.js   # 渲染进程构建配置
├── jest.config.js               # 测试配置
├── package.json                 # 项目配置与脚本
└── README.md
```

## 🚀 快速开始

### 环境准备

1. **安装 Node.js**
   ```bash
   # 推荐使用 Node.js 18.x 或更高版本
   # 从 https://nodejs.org 下载并安装
   node --version  # 验证安装
   npm --version   # 验证安装
   ```

2. **安装 Git**
   ```bash
   # 从 https://git-scm.com 下载并安装
   git --version  # 验证安装
   ```

3. **安装 VS Code** (推荐)
   ```bash
   # 从 https://code.visualstudio.com 下载并安装
   # 推荐插件：
   # - ES7+ React/Redux/React-Native snippets
   # - TypeScript Importer
   # - Prettier - Code formatter
   # - ESLint
   ```

### 项目安装

```
# 克隆与安装
git clone <repository-url>
cd .
npm install

# 开发模式（并发启动主/渲染）
npm run dev

# 启动 Electron（依赖渲染服务）
npm start
```

### 开发命令

```
# 开发与构建
npm run dev                 # 并发启动渲染/主进程构建
npm run build               # 构建生产版本（渲染+主进程）
npm run build:renderer      # 仅构建渲染进程
npm run build:main          # 仅构建主进程
npm start                   # 启动 Electron 指向本地开发地址

# 测试与质量
npm run test                # 运行 Jest 测试
npm run test:watch          # 监听测试
npm run lint                # ESLint 检查
npm run lint:fix            # 自动修复
npm run format              # Prettier 格式化

# 打包与分发
npm run pack                # 目录打包
npm run dist                # 平台打包
npm run dist:mac            # 打包 macOS
npm run dist:win            # 打包 Windows
npm run dist:linux          # 打包 Linux
```

## 🔧 开发指南

### 核心概念

1. **主进程 (Main Process)**
   - 应用程序的入口点
   - 负责创建和管理 BrowserWindow
   - 处理系统级操作和原生API调用

2. **渲染进程 (Renderer Process)**
   - 运行 React 应用
   - 负责用户界面渲染
   - 通过 IPC 与主进程通信

3. **预加载脚本 (Preload Script)**
   - 安全的桥梁，连接渲染进程和主进程
   - 暴露安全的 API 给渲染进程使用

### 安全最佳实践

- 启用 `contextIsolation` 与 `nodeIntegration: false`
- 通过 `preload.ts` 暴露受控 API（`window.electronAPI`）
- 严格的输入验证与错误处理
- 加密仅在主进程执行，渲染进程不持有密钥

### 数据库操作

```typescript
// 示例：数据库连接和操作
import Database from 'better-sqlite3';

const db = new Database('passwords.db');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    username TEXT,
    password TEXT NOT NULL,
    url TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 插入数据
const stmt = db.prepare('INSERT INTO passwords (title, username, password) VALUES (?, ?, ?)');
const result = stmt.run('GitHub', 'username', 'encrypted_password');
```

### IPC 通信

```typescript
// 主进程 (main.ts)
import { ipcMain } from 'electron';

ipcMain.handle('get-passwords', async () => {
  // 返回密码列表
  return passwords;
});

// 渲染进程 (React 组件)
const passwords = await window.electronAPI.getPasswords();
```

## 🧪 测试

- 使用 `jest` 进行单元测试与数据层逻辑测试
- 组件测试可结合 `@testing-library/react`（未默认集成）

## 📦 构建与发布

```
# 本地打包
npm run dist:mac
npm run dist:win
npm run dist:linux
```

自动发布可通过 `electron-builder publish` 与 CI/CD 集成（可选，未默认配置）。

## 🔒 加密实现概览

- `src/shared/security/crypto.ts` 使用 PBKDF2（salt='salt', 10000次）派生 32 字节密钥
- AES-256-CBC 加密（随机 IV，格式 `ivHex:cipherHex`），主进程统一调用
- 加密字段：`passwords.password`、`passwords.multi_accounts`、`password_history.old_password/new_password`

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

### 开发规范

- 遵循 TypeScript 严格模式
- 使用 ESLint 和 Prettier 保持代码风格
- 编写单元测试和集成测试
- 更新相关文档

## 📚 学习资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [React 官方文档](https://reactjs.org/docs)
- [TypeScript 官方文档](https://www.typescriptlang.org/docs)
- [Ant Design 文档](https://ant.design/docs/react/introduce)

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 支持

- 查看 [常见问题](docs/FAQ.md)
- 在仓库 Issues 提问或反馈

## 🗺️ 路线图

- [x] v0.9 核心功能（CRUD/分组/历史/搜索/生成器）
- [x] v0.10 导入导出（JSON/CSV）、数据完整性检查
- [ ] v1.0 加密 ZIP 导出、更多设置项与主题适配

---

**⚠️ 免责声明**: 本工具仅用于教育和合法用途。用户需要对自己的密码安全负责。
