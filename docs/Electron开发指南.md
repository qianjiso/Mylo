# Electron 密码管理器开发指南

## 📖 前言

欢迎来到 Electron 密码管理器开发指南！本指南专为 Electron 新手设计，将从最基础的环境配置开始，一步步带你完成一个功能完整的跨平台密码管理应用。

## 🎯 学习目标

完成本指南后，你将掌握：
- Electron 开发环境的搭建
- React + TypeScript 项目配置
- 数据库集成与加密技术
- 桌面应用打包与发布
- 安全最佳实践

## 🛠️ 环境配置

### 1. 安装 Node.js

**为什么需要 Node.js？**
Electron 基于 Node.js，需要 Node.js 运行时环境来执行 JavaScript 代码。

**安装步骤：**

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 **LTS** 版本（推荐 18.x 或更高版本）
3. 运行安装程序，按默认设置安装

**验证安装：**
```bash
# 打开终端，检查版本
node --version
npm --version
```

预期输出：
```
v18.17.0
9.6.7
```

### 2. 安装代码编辑器

**推荐：Visual Studio Code**

1. 访问 [VS Code 官网](https://code.visualstudio.com/)
2. 下载并安装
3. 安装以下必备插件：
   - **ES7+ React/Redux/React-Native snippets** - React 代码片段
   - **TypeScript Importer** - 自动导入 TypeScript 模块
   - **Prettier - Code formatter** - 代码格式化
   - **ESLint** - 代码质量检查
   - **Auto Rename Tag** - 自动重命名标签
   - **GitLens** - Git 增强工具

### 3. 安装 Git（可选但推荐）

**为什么需要 Git？**
用于版本控制，方便管理代码历史和协作开发。

**安装步骤：**
1. 访问 [Git 官网](https://git-scm.com/)
2. 下载并安装
3. 配置用户信息：
```bash
git config --global user.name "你的姓名"
git config --global user.email "你的邮箱"
```

## 🚀 项目初始化

### 1. 创建项目目录

```bash
# 创建项目文件夹
mkdir password-manager
cd password-manager

# 初始化 npm 项目
npm init -y
```

### 2. 安装核心依赖

```bash
# 安装 Electron
npm install --save-dev electron

# 安装 React 和 TypeScript
npm install react react-dom
npm install --save-dev @types/react @types/react-dom typescript

# 安装 Webpack 构建工具
npm install --save-dev webpack webpack-cli webpack-dev-server
npm install --save-dev ts-loader css-loader style-loader html-webpack-plugin

# 安装 UI 组件库
npm install antd
```

### 3. 配置 TypeScript

创建 `tsconfig.json` 文件：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["DOM", "DOM.Iterable", "ES6"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. 创建项目结构

```bash
# 创建源代码目录结构
mkdir -p src/{main,renderer,shared}
mkdir -p src/renderer/{components,pages,hooks,utils,types}
mkdir -p src/main/{database,security,utils}
mkdir -p src/shared/{types,utils}
mkdir -p assets/icons
```

## 📁 项目文件详解

### 1. 主进程文件 (src/main/main.ts)

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow;

function createWindow(): void {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    webPreferences: {
      nodeIntegration: false, // 安全配置
      contextIsolation: true, // 启用上下文隔离
      preload: path.join(__dirname, 'preload.js') // 预加载脚本
    }
  });

  // 加载应用
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools(); // 开发模式下打开开发者工具
  } else {
    mainWindow.loadFile('dist/renderer/index.html');
  }
}

// 应用准备就绪时创建窗口
app.whenReady().then(createWindow);

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

### 2. 渲染进程入口 (src/renderer/index.tsx)

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
```

### 3. 主应用组件 (src/renderer/App.tsx)

```tsx
import React from 'react';
import { Layout, Menu } from 'antd';
import {
  LockOutlined,
  SettingOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import PasswordList from './components/PasswordList';
import Settings from './components/Settings';

const { Header, Sider, Content } = Layout;

const App: React.FC = () => {
  const [selectedMenu, setSelectedMenu] = React.useState('passwords');

  const renderContent = () => {
    switch (selectedMenu) {
      case 'passwords':
        return <PasswordList />;
      case 'settings':
        return <Settings />;
      default:
        return <PasswordList />;
    }
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <LockOutlined style={{ fontSize: '24px', color: '#1890ff', marginRight: '12px' }} />
        <h1 style={{ color: 'white', margin: 0 }}>密码管理器</h1>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedMenu]}
            onClick={({ key }) => setSelectedMenu(key)}
            style={{ height: '100%', borderRight: 0 }}
          >
            <Menu.Item key="passwords" icon={<LockOutlined />}>
              密码列表
            </Menu.Item>
            <Menu.Item key="settings" icon={<SettingOutlined />}>
              设置
            </Menu.Item>
          </Menu>
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              background: '#fff',
              padding: 24,
              margin: 0,
              minHeight: 280,
            }}
          >
            {renderContent()}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default App;
```

### 4. HTML 模板 (src/renderer/index.html)

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>密码管理器</title>
</head>
<body>
    <div id="root"></div>
</body>
</html>
```

## 🔧 开发工具配置

### 1. Webpack 配置

**渲染进程配置 (webpack.renderer.config.js)：**

```javascript
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/renderer/index.tsx',
  target: 'electron-renderer',
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'bundle.js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
    }),
  ],
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
  },
};
```

**主进程配置 (webpack.main.config.js)：**

```javascript
const path = require('path');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/main/main.ts',
  target: 'electron-main',
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: 'main.js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
```

### 2. Package.json 脚本配置

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:renderer\" \"npm run dev:main\"",
    "dev:renderer": "webpack serve --config webpack.renderer.config.js",
    "dev:main": "webpack --config webpack.main.config.js --watch",
    "build": "npm run build:renderer && npm run build:main",
    "build:renderer": "webpack --config webpack.renderer.config.js --mode production",
    "build:main": "webpack --config webpack.main.config.js --mode production",
    "start": "electron .",
    "pack": "electron-builder --dir",
    "dist": "npm run build && electron-builder"
  }
}
```

## 🏃‍♂️ 开发流程

### 1. 启动开发环境

```bash
# 安装所有依赖
npm install

# 启动开发服务器
npm run dev
```

这将同时启动：
- 渲染进程开发服务器（端口 3000）
- 主进程文件监听和编译
- Electron 应用窗口

### 2. 开发调试

**主进程调试：**
- 使用 VS Code 调试配置
- 添加 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": [".", "--remote-debugging-port=9222"],
      "outputCapture": "std"
    }
  ]
}
```

**渲染进程调试：**
- 使用 Chrome DevTools
- 在开发模式下会自动打开开发者工具

### 3. 代码质量工具

**ESLint 配置 (.eslintrc.js)：**

```javascript
module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/react-in-jsx-scope': 'off',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
```

**Prettier 配置 (.prettierrc)：**

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

## 📦 构建与打包

### 1. 生产构建

```bash
# 构建所有代码
npm run build

# 启动应用
npm start
```

### 2. 打包为可执行文件

**安装 electron-builder：**

```bash
npm install --save-dev electron-builder
```

**配置 package.json 构建选项：**

```json
{
  "build": {
    "appId": "com.yourcompany.password-manager",
    "productName": "Password Manager",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "target": "dmg"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

**执行打包：**

```bash
# 打包所有平台
npm run dist

# 仅打包 macOS
npm run dist:mac

# 仅打包 Windows
npm run dist:win

# 仅打包 Linux
npm run dist:linux
```

## 🔒 安全最佳实践

### 1. Electron 安全配置

```typescript
// 在主进程中配置安全选项
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,        // 禁用 Node.js 集成
    contextIsolation: true,        // 启用上下文隔离
    enableRemoteModule: false,     // 禁用 remote 模块
    webSecurity: true,             // 启用 Web 安全
    allowRunningInsecureContent: false, // 禁止不安全内容
    preload: path.join(__dirname, 'preload.js') // 预加载脚本
  }
});
```

### 2. 预加载脚本 (src/main/preload.ts)

```typescript
import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 数据库操作
  getPasswords: () => ipcRenderer.invoke('get-passwords'),
  savePassword: (password: any) => ipcRenderer.invoke('save-password', password),
  deletePassword: (id: number) => ipcRenderer.invoke('delete-password', id),
  
  // 加密操作
  encryptData: (data: string) => ipcRenderer.invoke('encrypt-data', data),
  decryptData: (encryptedData: string) => ipcRenderer.invoke('decrypt-data', encryptedData),
  
  // 系统操作
  showMessageBox: (options: any) => ipcRenderer.invoke('show-message-box', options),
});
```

### 3. 内容安全策略 (CSP)

在 HTML 模板中添加 CSP：

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';">
```

## 🎨 UI 组件开发

### 1. 密码列表组件 (src/renderer/components/PasswordList.tsx)

```tsx
import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

interface PasswordItem {
  id: number;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

const PasswordList: React.FC = () => {
  const [passwords, setPasswords] = useState<PasswordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPassword, setEditingPassword] = useState<PasswordItem | null>(null);
  const [form] = Form.useForm();

  // 加载密码列表
  const loadPasswords = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getPasswords();
      setPasswords(result);
    } catch (error) {
      message.error('加载密码列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPasswords();
  }, []);

  // 保存密码
  const handleSave = async (values: any) => {
    try {
      await window.electronAPI.savePassword({
        ...values,
        id: editingPassword?.id
      });
      message.success('保存成功');
      setModalVisible(false);
      form.resetFields();
      setEditingPassword(null);
      loadPasswords();
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 删除密码
  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个密码吗？',
      onOk: async () => {
        try {
          await window.electronAPI.deletePassword(id);
          message.success('删除成功');
          loadPasswords();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      render: (text: string) => '••••••••',
    },
    {
      title: '网址',
      dataIndex: 'url',
      key: 'url',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: PasswordItem) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingPassword(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingPassword(null);
            form.resetFields();
            setModalVisible(true);
          }}
        >
          添加密码
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={passwords}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title={editingPassword ? '编辑密码' : '添加密码'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingPassword(null);
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="例如：GitHub" />
          </Form.Item>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="用户名或邮箱" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="密码" />
          </Form.Item>
          <Form.Item name="url" label="网址">
            <Input placeholder="https://example.com" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PasswordList;
```

## 🗄️ 数据库集成

### 1. 安装数据库依赖

```bash
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

### 2. 数据库服务 (src/main/database/DatabaseService.ts)

```typescript
import Database from 'better-sqlite3';
import * as path from 'path';
import * as crypto from 'crypto';

export interface PasswordItem {
  id?: number;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

class DatabaseService {
  private db: Database.Database;
  private encryptionKey: string;

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'passwords.db');
    this.db = new Database(dbPath);
    this.encryptionKey = this.getOrCreateEncryptionKey();
    this.initDatabase();
  }

  private getOrCreateEncryptionKey(): string {
    // 这里应该从安全存储中获取密钥
    // 暂时使用简单的方式，实际应用中需要更安全的密钥管理
    return 'your-secure-encryption-key-32-chars';
  }

  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS passwords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        url TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private encrypt(text: string): string {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from('password-manager', 'utf8'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedData: string): string {
    const algorithm = 'aes-256-gcm';
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    decipher.setAAD(Buffer.from('password-manager', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  public getPasswords(): PasswordItem[] {
    const stmt = this.db.prepare('SELECT * FROM passwords ORDER BY created_at DESC');
    const passwords = stmt.all() as PasswordItem[];
    
    // 解密密码字段
    return passwords.map(password => ({
      ...password,
      password: this.decrypt(password.password)
    }));
  }

  public savePassword(password: PasswordItem): number {
    const encryptedPassword = this.encrypt(password.password);
    
    if (password.id) {
      // 更新现有密码
      const stmt = this.db.prepare(`
        UPDATE passwords 
        SET title = ?, username = ?, password = ?, url = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(
        password.title,
        password.username,
        encryptedPassword,
        password.url,
        password.notes,
        password.id
      );
      return password.id;
    } else {
      // 插入新密码
      const stmt = this.db.prepare(`
        INSERT INTO passwords (title, username, password, url, notes)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        password.title,
        password.username,
        encryptedPassword,
        password.url,
        password.notes
      );
      return result.lastInsertRowid as number;
    }
  }

  public deletePassword(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM passwords WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  public close(): void {
    this.db.close();
  }
}

export default DatabaseService;
```

## 🧪 测试

### 1. 安装测试依赖

```bash
npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
```

### 2. 测试配置 (jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
  ],
};
```

### 3. 组件测试示例

```tsx
// src/renderer/components/__tests__/PasswordList.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PasswordList from '../PasswordList';

// Mock Electron API
global.electronAPI = {
  getPasswords: jest.fn(),
  savePassword: jest.fn(),
  deletePassword: jest.fn(),
};

describe('PasswordList', () => {
  test('renders password list', async () => {
    const mockPasswords = [
      {
        id: 1,
        title: 'GitHub',
        username: 'testuser',
        password: 'password123',
        url: 'https://github.com',
        notes: '',
      },
    ];

    (global.electronAPI.getPasswords as jest.Mock).mockResolvedValue(mockPasswords);

    render(<PasswordList />);
    
    expect(screen.getByText('密码列表')).toBeInTheDocument();
    expect(screen.getByText('添加密码')).toBeInTheDocument();
  });
});
```

## 🚀 部署与发布

### 1. 代码签名

**macOS 代码签名：**

```json
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name",
      "hardenedRuntime": true,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    }
  }
}
```

### 2. 自动更新

```bash
npm install electron-updater
```

```typescript
// 在主进程中添加自动更新
import { autoUpdater } from 'electron-updater';

app.whenReady().then(() => {
  // 检查更新
  autoUpdater.checkForUpdatesAndNotify();
  
  autoUpdater.on('update-available', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: '发现新版本，正在后台下载...',
    });
  });
  
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '更新就绪',
      message: '新版本已下载完成，重启应用即可更新',
      buttons: ['立即重启', '稍后重启']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
});
```

## 📚 学习资源

### 官方文档
- [Electron 官方文档](https://www.electronjs.org/docs)
- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [Ant Design 文档](https://ant.design/)

### 推荐教程
- [Electron React TypeScript Starter](https://github.com/electron-react-boilerplate/electron-react-boilerplate)
- [Electron 安全最佳实践](https://www.electronjs.org/docs/tutorial/security)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

### 社区资源
- [Electron GitHub](https://github.com/electron/electron)
- [React GitHub](https://github.com/facebook/react)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/electron)

## 🎯 下一步

完成基础开发后，你可以继续学习：

1. **高级功能开发**
   - 密码生成器
   - 生物识别登录
   - 数据导入导出
   - 云同步功能

2. **性能优化**
   - 代码分割
   - 懒加载
   - 虚拟滚动
   - 内存优化

3. **用户体验**
   - 快捷键支持
   - 系统托盘集成
   - 通知系统
   - 主题切换

4. **安全增强**
   - 主密码策略
   - 两步验证
   - 安全审计
   - 数据备份

## 🤝 获取帮助

如果在开发过程中遇到问题：

1. 查看官方文档
2. 搜索 Stack Overflow
3. 提问 GitHub Issues
4. 加入相关社区论坛

---

**祝你开发愉快！** 🎉

记住，学习编程是一个循序渐进的过程，不要急于求成。遇到问题时保持耐心，多尝试、多思考、多请教，你一定能成为一名优秀的 Electron 开发者！