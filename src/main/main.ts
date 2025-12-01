import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import DatabaseService from './database/DatabaseService';
import { initLogger, getLogFilePath } from './logger';

class PasswordManagerApp {
  private mainWindow: BrowserWindow | null = null;
  private databaseService: DatabaseService | null = null;

  constructor() {
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
        
        // 设置IPC处理器
        this.setupIpcHandlers();
        this.registerWindowIpc();
        
        // 移除非 macOS 平台的默认菜单栏
        if (process.platform !== 'darwin') {
          Menu.setApplicationMenu(null);
        }
        
        // 创建主窗口
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
      // 开发模式下打开开发者工具
      this.mainWindow.webContents.openDevTools();
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
  }

  private setupIpcHandlers(): void {
    if (!this.databaseService) return;

    // 获取所有密码
    ipcMain.handle('get-passwords', async (_, groupId?: number) => {
      return this.databaseService!.getPasswords(groupId);
    });

    // 添加新密码
    ipcMain.handle('add-password', async (_, password) => {
      const id = this.databaseService!.savePassword(password);
      return { success: true, id };
    });

    // 更新密码
    ipcMain.handle('update-password', async (_, id, password) => {
      try {
        const updatedPassword = { ...password, id };
        this.databaseService!.savePassword(updatedPassword);
        return { success: true };
      } catch (error) {
        const msg = (error as any)?.message || '更新失败';
        const code = (error as any)?.code || '';
        const suggest = code === 'SQLITE_CORRUPT_VTAB' || /malformed/i.test(msg)
          ? '数据库索引可能已损坏，请备份后尝试“导入导出”或联系支持'
          : undefined;
        return { success: false, error: suggest ? `${msg}（${suggest}）` : msg };
      }
    });

    // 删除密码
    ipcMain.handle('delete-password', async (_, id) => {
      const success = this.databaseService!.deletePassword(id);
      return { success };
    });

    // 获取密码历史记录
    ipcMain.handle('get-password-history', async (_, passwordId: number) => {
      return this.databaseService!.getPasswordHistory(passwordId);
    });

    // 获取需要更新密码的列表
    ipcMain.handle('get-passwords-needing-update', async () => {
      return this.databaseService!.getPasswordsNeedingUpdate();
    });

    // 分组相关
    ipcMain.handle('get-groups', async () => {
      return this.databaseService!.getGroups();
    });

    ipcMain.handle('get-group-tree', async (_, parentId?: number) => {
      return this.databaseService!.getGroupWithChildren(parentId);
    });

    ipcMain.handle('add-group', async (_, group) => {
      try {
        const id = this.databaseService!.saveGroup(group);
        return { success: true, id };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('update-group', async (_, id, group) => {
      try {
        const updatedGroup = { ...group, id };
        this.databaseService!.saveGroup(updatedGroup);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('delete-group', async (_, id) => {
      const success = this.databaseService!.deleteGroup(id);
      return { success };
    });

    ipcMain.handle('get-note-groups', async () => {
      return this.databaseService!.getNoteGroups();
    });

    ipcMain.handle('get-note-group-tree', async (_, parentId?: number) => {
      return this.databaseService!.getNoteGroupTree(parentId);
    });

    ipcMain.handle('add-note-group', async (_, group) => {
      try {
        const id = this.databaseService!.saveNoteGroup(group);
        return { success: true, id };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('update-note-group', async (_, id, group) => {
      try {
        const updated = { ...group, id };
        this.databaseService!.saveNoteGroup(updated);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('delete-note-group', async (_, id) => {
      const success = this.databaseService!.deleteNoteGroup(id);
      return { success };
    });

    ipcMain.handle('get-notes', async (_, groupId?: number) => {
      return this.databaseService!.getNotes(groupId);
    });

    ipcMain.handle('get-note', async (_, id: number) => {
      return this.databaseService!.getNoteById(id);
    });

    ipcMain.handle('add-note', async (_, note) => {
      try {
        const id = this.databaseService!.saveNote(note);
        return { success: true, id };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('update-note', async (_, id, note) => {
      try {
        const updated = { ...note, id };
        this.databaseService!.saveNote(updated);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('delete-note', async (_, id) => {
      const success = this.databaseService!.deleteNote(id);
      return { success };
    });

    ipcMain.handle('search-notes-title', async (_, keyword: string) => {
      return this.databaseService!.searchNotesByTitle(keyword);
    });
    

    // 生成密码（支持用户设置默认值）
    ipcMain.handle('generate-password', async (_, options) => {
      const lenSetting = this.databaseService!.getUserSettingByKey('security.password_generator_length');
      const upSetting = this.databaseService!.getUserSettingByKey('security.password_generator_include_uppercase');
      const lowSetting = this.databaseService!.getUserSettingByKey('security.password_generator_include_lowercase');
      const numSetting = this.databaseService!.getUserSettingByKey('security.password_generator_include_numbers');
      const symSetting = this.databaseService!.getUserSettingByKey('security.password_generator_include_symbols');
      const defaultLength = lenSetting ? Number(lenSetting.value) || 16 : 16;
      const defaultIncludeUppercase = upSetting ? upSetting.value === 'true' : true;
      const defaultIncludeLowercase = lowSetting ? lowSetting.value === 'true' : true;
      const defaultIncludeNumbers = numSetting ? numSetting.value === 'true' : true;
      const defaultIncludeSymbols = symSetting ? symSetting.value === 'true' : true;
      const length = typeof options.length === 'number' ? options.length : defaultLength;
      let charset = '';
      const includeUppercase = typeof options.includeUppercase === 'boolean' ? options.includeUppercase : defaultIncludeUppercase;
      const includeLowercase = typeof options.includeLowercase === 'boolean' ? options.includeLowercase : defaultIncludeLowercase;
      const includeNumbers = typeof options.includeNumbers === 'boolean' ? options.includeNumbers : defaultIncludeNumbers;
      const includeSymbols = typeof options.includeSymbols === 'boolean' ? options.includeSymbols : defaultIncludeSymbols;
      
      if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
      if (includeNumbers) charset += '0123456789';
      if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      if (!charset) charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      
      let password = '';
      for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      return password;
    });

    // 获取应用版本
    ipcMain.handle('get-version', async () => {
      return app.getVersion();
    });

    // 退出应用
    ipcMain.handle('quit', async () => {
      app.quit();
    });

    // 导出数据
    ipcMain.handle('export-data', async (_, options: {
      format: 'json' | 'encrypted_zip';
      includeHistory: boolean;
      includeGroups: boolean;
      includeSettings: boolean;
      passwordStrength: 'weak' | 'medium' | 'strong';
      compressionLevel: number;
      archivePassword?: string;
    }) => {
      try {
        const data = await this.databaseService!.exportData(options);
        return { success: true, data: Array.from(data) };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // 导入数据
    ipcMain.handle('import-data', async (_, data: number[], options: {
      format: 'json' | 'csv' | 'encrypted_zip';
      mergeStrategy: 'replace' | 'merge' | 'skip';
      validateIntegrity: boolean;
      dryRun: boolean;
      archivePassword?: string;
    }) => {
      try {
        const uint8Array = new Uint8Array(data);
        const result = await this.databaseService!.importData(uint8Array, options);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // 用户设置相关
    ipcMain.handle('get-user-settings', async (_, category?: string) => {
      return this.databaseService!.getUserSettings(category);
    });

    ipcMain.handle('get-user-setting', async (_, key: string) => {
      return this.databaseService!.getUserSettingByKey(key);
    });

    ipcMain.handle('set-user-setting', async (_, key: string, value: string, type?: string, category?: string, description?: string) => {
      try {
        const setting = {
          key,
          value,
          type: (type || 'string') as 'string' | 'number' | 'boolean' | 'json',
          category: category || 'general',
          description: description || ''
        };
        const success = this.databaseService!.saveUserSetting(setting);
        return { success };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('update-user-setting', async (_, key: string, value: string) => {
      try {
        const success = this.databaseService!.updateUserSetting(key, value);
        return { success };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('delete-user-setting', async (_, key: string) => {
      try {
        const success = this.databaseService!.deleteUserSetting(key);
        return { success };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('get-user-settings-categories', async () => {
      return this.databaseService!.getUserSettingsCategories();
    });

    // 搜索密码
    ipcMain.handle('search-passwords', async (_, keyword: string) => {
      return this.databaseService!.searchPasswords(keyword);
    });

    // 数据完整性检查
  ipcMain.handle('check-data-integrity', async () => {
    try {
      const result = this.databaseService!.checkDataIntegrity();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 数据完整性修复
  ipcMain.handle('repair-data-integrity', async () => {
    try {
      const result = this.databaseService!.repairDataIntegrity();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 高级搜索
    ipcMain.handle('advanced-search', async (_, options: any) => {
      return this.databaseService!.advancedSearch(options);
    });

    // 获取单个密码详情
    ipcMain.handle('get-password', async (_, id: number) => {
      return this.databaseService!.getPasswordById(id);
    });

    // 多账号密码管理
    ipcMain.handle('get-password-multi-accounts', async (_, id: number) => {
      return this.databaseService!.getPasswordMultiAccounts(id);
    });

    ipcMain.handle('set-password-multi-accounts', async (_, id: number, accounts: string) => {
      try {
        this.databaseService!.setPasswordMultiAccounts(id, accounts);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // 更新密码（记录历史）
    ipcMain.handle('update-password-with-history', async (_, id: number, newPassword: string, reason?: string) => {
      try {
        this.databaseService!.updatePassword(id, newPassword, reason);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // 分组相关扩展
    ipcMain.handle('get-group-by-id', async (_, id: number) => {
      return this.databaseService!.getGroupById(id);
    });

    ipcMain.handle('get-group-by-name', async (_, name: string, parentId?: number) => {
      return this.databaseService!.getGroupByName(name, parentId);
    });

    // 用户设置扩展
    ipcMain.handle('reset-setting-to-default', async (_, key: string) => {
      try {
        const success = this.databaseService!.resetSettingToDefault(key);
        return { success };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('reset-all-settings-to-default', async () => {
      try {
        const count = this.databaseService!.resetAllSettingsToDefault();
        return { success: true, count };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('import-settings', async (_, settings: any[]) => {
      try {
        const count = this.databaseService!.importSettings(settings);
        return { success: true, count };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('export-settings', async (_, categories?: string[]) => {
      try {
        const settings = this.databaseService!.exportSettings(categories);
        return { success: true, data: JSON.stringify(settings) };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // 密码历史记录扩展
    ipcMain.handle('add-password-history', async (_, history: any) => {
      try {
        const id = this.databaseService!.addPasswordHistory(history);
        return { success: true, id };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('get-history-by-id', async (_, id: number) => {
      return this.databaseService!.getHistoryById(id);
    });

    ipcMain.handle('delete-history', async (_, id: number) => {
      try {
        this.databaseService!.deleteHistory(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('clean-old-history', async (_, daysToKeep?: number) => {
      try {
        const count = this.databaseService!.cleanOldHistory(daysToKeep);
        return { success: true, count };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });
  }
}

// 创建应用实例
new PasswordManagerApp();
