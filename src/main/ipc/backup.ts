import { ipcMain, BrowserWindow } from 'electron';
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
}

