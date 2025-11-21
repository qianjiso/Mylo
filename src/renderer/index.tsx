import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';

// 在浏览器环境中导入mock electronAPI
if (process.env.NODE_ENV === 'development' && !window.electronAPI) {
  require('./electronAPI-mock');
}

// 渲染应用的入口点
const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
