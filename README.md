# 密码管理器 (Password Manager)

一个基于 Electron + React + TypeScript 的跨平台密码管理应用，提供安全、便捷的密码存储和管理功能。

## 🚀 项目特性

- 🔒 **安全第一**：采用AES-256加密，PBKDF2密钥派生
- 🖥️ **跨平台**：支持 Windows、macOS、Linux
- 🌐 **离线使用**：无需服务器，数据本地存储
- 🔄 **数据同步**：支持文件导入导出，设备间数据同步
- 🎯 **用户友好**：基于 Ant Design 的现代化界面
- 🔐 **生物识别**：支持 Touch ID/Face ID/指纹识别
- 🎲 **密码生成**：强密码生成器，可自定义规则
- 📱 **响应式设计**：适配不同屏幕尺寸

## 📋 系统要求

- **操作系统**: Windows 10+, macOS 10.14+, Ubuntu 18.04+
- **内存**: 至少 4GB RAM
- **磁盘空间**: 至少 200MB 可用空间
- **网络**: 首次安装需要网络下载依赖

## 🛠️ 技术栈

- **框架**: Electron 27.x
- **前端**: React 18 + TypeScript 5
- **UI库**: Ant Design 5
- **状态管理**: React Hooks + Context API
- **数据库**: SQLite (better-sqlite3)
- **加密**: Node.js crypto + crypto-js
- **构建工具**: Webpack 5
- **测试**: Jest + React Testing Library
- **代码质量**: ESLint + Prettier

## 📁 项目结构

```
mima_package/
├── src/
│   ├── main/                 # Electron 主进程
│   │   ├── main.ts          # 主进程入口
│   │   ├── preload.ts       # 预加载脚本
│   │   └── menu.ts          # 应用菜单
│   ├── renderer/            # 渲染进程 (React 应用)
│   │   ├── index.tsx        # React 应用入口
│   │   ├── App.tsx          # 主应用组件
│   │   ├── components/      # UI 组件
│   │   │   ├── PasswordList.tsx
│   │   │   ├── PasswordForm.tsx
│   │   │   └── PasswordGenerator.tsx
│   │   ├── pages/           # 页面组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Login.tsx
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── utils/           # 工具函数
│   │   ├── types/           # TypeScript 类型定义
│   │   └── styles/          # 样式文件
│   ├── shared/              # 共享代码
│   │   ├── types/           # 共享类型定义
│   │   └── constants/       # 常量定义
│   └── database/            # 数据库相关
│       ├── connection.ts    # 数据库连接
│       ├── migrations/      # 数据库迁移
│       └── models/          # 数据模型
├── public/                  # 静态资源
│   ├── index.html          # HTML 模板
│   └── icons/              # 应用图标
├── dist/                   # 构建输出目录
├── release/                # 打包输出目录
├── docs/                   # 项目文档
├── tests/                  # 测试文件
├── package.json            # 项目配置
├── tsconfig.json           # TypeScript 配置
├── webpack.main.config.js   # 主进程 Webpack 配置
├── webpack.renderer.config.js # 渲染进程 Webpack 配置
├── jest.config.js          # Jest 测试配置
├── .eslintrc.js            # ESLint 配置
├── .prettierrc             # Prettier 配置
└── .gitignore              # Git 忽略文件
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

```bash
# 1. 克隆项目
git clone <repository-url>
cd mima_package

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

### 开发命令

```bash
# 开发模式
npm run dev              # 启动开发服务器

# 构建项目
npm run build            # 构建生产版本
npm run build:main       # 构建主进程
npm run build:renderer   # 构建渲染进程

# 测试
npm run test             # 运行测试
npm run test:watch       # 监听模式运行测试
npm run test:coverage    # 生成测试覆盖率报告

# 代码质量
npm run lint             # 运行 ESLint 检查
npm run lint:fix         # 自动修复 ESLint 问题
npm run format           # 格式化代码

# 打包应用
npm run pack             # 打包应用（不压缩）
npm run dist             # 打包应用（压缩）
npm run dist:all         # 打包所有平台版本
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

- 启用 `contextIsolation` 和 `nodeIntegration: false`
- 使用预加载脚本安全地暴露 API
- 验证和清理所有用户输入
- 使用 HTTPS 加载外部资源
- 定期更新依赖项

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

### 单元测试

```typescript
// 示例：组件测试
import { render, screen } from '@testing-library/react';
import { PasswordList } from './PasswordList';

test('renders password list', () => {
  const passwords = [
    { id: 1, title: 'GitHub', username: 'user1' }
  ];
  
  render(<PasswordList passwords={passwords} />);
  expect(screen.getByText('GitHub')).toBeInTheDocument();
});
```

### 集成测试

```typescript
// 示例：IPC 测试
import { app, BrowserWindow } from 'electron';
import { ipcMain } from 'electron';

test('should handle get-passwords IPC', async () => {
  const result = await ipcMain.handle('get-passwords');
  expect(Array.isArray(result)).toBe(true);
});
```

## 📦 构建和发布

### 本地构建

```bash
# 构建 macOS 版本
npm run dist:mac

# 构建 Windows 版本
npm run dist:win

# 构建 Linux 版本
npm run dist:linux
```

### 自动发布

项目配置了自动发布流程，当推送新标签时：

1. 自动运行测试
2. 构建所有平台版本
3. 创建 GitHub Release
4. 上传安装包

## 🔒 安全架构

### 加密流程

1. **主密码** → PBKDF2 → **主密钥**
2. **密码数据** → AES-256 (主密钥) → **加密存储**
3. **数据库文件** → SQLite 加密 → **文件加密**

### 安全特性

- 内存中密钥自动清理
- 防止截屏和内存转储
- 安全的随机数生成
- 密码强度检测
- 自动锁定机制

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

如果您遇到问题或有建议，请：

1. 查看 [常见问题](docs/FAQ.md)
2. 搜索 [Issues](../../issues)
3. 创建新的 [Issue](../../issues/new)

## 🗺️ 路线图

- [ ] **v1.0** - 基础功能实现
  - [x] 密码存储和管理
  - [x] 密码生成器
  - [x] 基础搜索功能
  - [ ] 数据导入导出

- [ ] **v1.1** - 增强功能
  - [ ] 浏览器扩展集成
  - [ ] 云同步支持
  - [ ] 高级搜索和过滤
  - [ ] 密码强度分析

- [ ] **v2.0** - 企业版功能
  - [ ] 团队协作
  - [ ] 权限管理
  - [ ] 审计日志
  - [ ] SSO 集成

---

**⚠️ 免责声明**: 本工具仅用于教育和合法用途。用户需要对自己的密码安全负责。