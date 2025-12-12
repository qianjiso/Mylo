import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import * as path from 'path';
import DatabaseService from './database/DatabaseService';
import { initLogger, getLogFilePath } from './logger';
import { registerPasswordIpc } from './ipc/passwords';
import { registerGroupIpc } from './ipc/groups';
import { registerNotesIpc } from './ipc/notes';
import { registerSettingsIpc } from './ipc/settings';
import { registerBackupIpc } from './ipc/backup';
import { registerSecurityIpc } from './ipc/security';

class PasswordManagerApp {
  private mainWindow: BrowserWindow | null = null;
  private databaseService: DatabaseService | null = null;

  constructor() {
    try {
      // 在主进程启动时，根据 app.isPackaged 为开发模式设置独立的 userData 路径，采用“原目录名 + -dev ”后缀。
      if (!app.isPackaged) {
        const def = app.getPath('userData');
        const devPath = path.join(path.dirname(def), `${path.basename(def)}-dev`);
        app.setPath('userData', devPath);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('set userData failed', msg);
    }
    initLogger();
    console.info('app starting');
    this.init();
  }

  private async init(): Promise<void> {
    // 设置应用程序用户模型ID (Windows)
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.passwordmanager.app');
    }

    // 当 Electron 完成初始化并准备创建浏览器窗口时调用此方法
    app.whenReady().then(async () => {
      try {
        console.info('app ready');
        // 初始化数据库服务
        this.databaseService = new DatabaseService();
        console.info('database initialized at', getLogFilePath());
        
        // 设置IPC处理器（分域注册）
        registerPasswordIpc(this.databaseService!);
        registerGroupIpc(this.databaseService!);
        registerNotesIpc(this.databaseService!);
        registerSettingsIpc(this.databaseService!);
        registerBackupIpc(this.databaseService!, this.mainWindow);
        registerSecurityIpc(this.databaseService!, this.databaseService!.getSecurityService());
        this.registerWindowIpc();
        
        // 移除非 macOS 平台的默认菜单栏
        if (process.platform !== 'darwin') {
          Menu.setApplicationMenu(null);
        }
        
        if (process.env.E2E_EXPORT_IMPORT === '1') {
          try {
            const exp = await this.databaseService!.exportData({ format: 'json', includeHistory: true, includeGroups: true, includeSettings: true });
            const res = await this.databaseService!.importData(new Uint8Array(exp), { format: 'json', mergeStrategy: 'merge', validateIntegrity: true, dryRun: false });
            console.info('e2e export/import done', JSON.stringify({ imported: res.imported ?? 0, errors: res.errors?.length || 0 }));
            app.quit();
            return;
          } catch (err) {
            console.error('e2e export/import failed', err);
            app.quit();
            return;
          }
        }

        this.createMainWindow();
        console.info('main window created');
      } catch (error) {
        console.error('Failed to initialize app:', error);
        app.quit();
       }
      
      app.on('activate', () => {
        // 在 macOS 上，当单击 dock 图标并且没有其他窗口打开时，
        // 通常在应用程序中重新创建一个窗口
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // 当所有窗口都关闭时退出应用
    app.on('window-all-closed', () => {
      // 在 macOS 上，应用程序及其菜单栏通常保持活动状态，
      // 直到用户使用 Cmd + Q 明确退出
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('before-quit', () => {
      if (this.databaseService) {
        this.databaseService.close();
      }
    });
  }

  private createMainWindow(): void {
    // 创建浏览器窗口
    this.mainWindow = new BrowserWindow({
      title: 'Mylo',
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      titleBarStyle: 'default',
      show: false, // 先不显示，等加载完成后再显示
      autoHideMenuBar: process.platform !== 'darwin'
    });

    // 加载应用
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
        this.mainWindow.webContents.openDevTools();
      }
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // 当窗口准备好显示时显示窗口
    this.mainWindow.once('ready-to-show', () => {
      if (process.platform !== 'darwin') {
        this.mainWindow?.setMenuBarVisibility(false);
      }
      this.mainWindow?.show();
      console.info('window ready-to-show');
    });

    // 当窗口关闭时清理
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      console.info('main window closed');
    });
  }

  public registerWindowIpc(): void {
    ipcMain.handle('window-minimize', async () => {
      this.mainWindow?.minimize();
    });
    ipcMain.handle('window-toggle-maximize', async () => {
      if (!this.mainWindow) return;
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
    });
    ipcMain.handle('window-close', async () => {
      this.mainWindow?.close();
    });
    ipcMain.handle('open-external', async (_e, url: string) => {
      if (!url || typeof url !== 'string') return;
      try {
        await shell.openExternal(url);
      } catch (err) {
        console.error('open-external failed', err);
      }
    });
  }

  private setupIpcHandlers(): void {}
}

// 创建应用实例
new PasswordManagerApp();
