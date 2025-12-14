import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import * as fs from 'fs';
import DatabaseService from '../database/DatabaseService';

export function registerBackupIpc(db: DatabaseService, win?: BrowserWindow | null) {
  ipcMain.handle('export-data', async (_, options: {
    format: 'json' | 'encrypted_zip';
    includeHistory?: boolean;
    includeGroups?: boolean;
    includeSettings?: boolean;
    archivePassword?: string;
  }) => {
    try {
      const data = await db.exportData(options);
      return { success: true, data: Array.from(data) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('export-data-to-file', async (_, options: {
    format: 'json' | 'encrypted_zip';
    includeHistory?: boolean;
    includeGroups?: boolean;
    includeSettings?: boolean;
    archivePassword?: string;
    filePath: string;
  }) => {
    try {
      if (!options.filePath) throw new Error('未选择导出路径');
      const data = await db.exportData(options);
      fs.writeFileSync(options.filePath, Buffer.from(data));
      return { success: true, filePath: options.filePath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('pick-export-path', async (_, opts: { defaultPath?: string; format: 'json' | 'encrypted_zip' }) => {
    try {
      const defaultExt = opts.format === 'encrypted_zip' ? 'zip' : 'json';
      const defaultFileName = `passwords_backup_${new Date().toISOString().split('T')[0]}.${defaultExt}`;
      const dialogRes = await dialog.showSaveDialog({
        defaultPath: opts.defaultPath || defaultFileName,
        filters: [
          { name: opts.format === 'encrypted_zip' ? 'Encrypted Zip' : 'JSON', extensions: [defaultExt] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (dialogRes.canceled) return { success: true, filePath: null };
      return { success: true, filePath: dialogRes.filePath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('import-data', async (_, data: number[], options: {
    format: 'json';
    mergeStrategy: 'replace' | 'merge' | 'skip';
    validateIntegrity: boolean;
    dryRun: boolean;
  }) => {
    try {
      const uint8Array = new Uint8Array(data);
      const result = await db.importData(uint8Array, options);
      win?.webContents.send('data-imported', { imported: result.imported, skipped: result.skipped });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('check-data-integrity', async () => {
    try {
      const result = db.checkDataIntegrity();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('repair-data-integrity', async () => {
    try {
      const result = db.repairDataIntegrity();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('pick-export-directory', async (_evt, opts: { defaultPath?: string }) => {
    try {
      const dialogRes = await dialog.showOpenDialog({
        defaultPath: opts.defaultPath || app.getPath('documents'),
        properties: ['openDirectory', 'createDirectory']
      });
      if (dialogRes.canceled) return { success: true, directory: null };
      return { success: true, directory: dialogRes.filePaths[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
