import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
const App = React.lazy(() => import('./App'));

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
      <React.Suspense fallback={(
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
          正在加载应用...
        </div>
      )}
      >
        <App />
      </React.Suspense>
    </ConfigProvider>
  </React.StrictMode>
);
