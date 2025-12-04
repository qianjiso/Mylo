import { ipcMain } from 'electron';
import DatabaseService from '../database/DatabaseService';

export function registerPasswordIpc(db: DatabaseService) {
  ipcMain.handle('get-passwords', async (_, groupId?: number) => {
    return db.getPasswords(groupId);
  });

  ipcMain.handle('add-password', async (_, password) => {
    const id = db.savePassword(password);
    return { success: true, id };
  });

  ipcMain.handle('update-password', async (_, id, password) => {
    try {
      const updatedPassword = { ...password, id };
      db.savePassword(updatedPassword);
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

  ipcMain.handle('delete-password', async (_, id) => {
    const success = db.deletePassword(id);
    return { success };
  });

  ipcMain.handle('get-password-history', async (_, passwordId: number) => {
    return db.getPasswordHistory(passwordId);
  });

  ipcMain.handle('get-passwords-needing-update', async () => {
    return db.getPasswordsNeedingUpdate();
  });

  ipcMain.handle('search-passwords', async (_, keyword: string) => {
    return db.searchPasswords(keyword);
  });

  ipcMain.handle('advanced-search', async (_, options: any) => {
    return db.advancedSearch(options);
  });

  ipcMain.handle('get-password', async (_, id: number) => {
    return db.getPasswordById(id);
  });

  ipcMain.handle('update-password-with-history', async (_, id: number, newPassword: string, reason?: string) => {
    try {
      db.updatePassword(id, newPassword, reason);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
