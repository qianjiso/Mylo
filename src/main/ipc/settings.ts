import { ipcMain } from 'electron';
import DatabaseService from '../database/DatabaseService';

export function registerSettingsIpc(db: DatabaseService) {
  ipcMain.handle('get-user-settings', async (_, category?: string) => {
    return db.getUserSettings(category);
  });

  ipcMain.handle('get-user-setting', async (_, key: string) => {
    return db.getUserSettingByKey(key);
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
      const success = db.saveUserSetting(setting);
      return { success };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('update-user-setting', async (_, key: string, value: string) => {
    try {
      const success = db.updateUserSetting(key, value);
      return { success };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('delete-user-setting', async (_, key: string) => {
    try {
      const success = db.deleteUserSetting(key);
      return { success };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('get-user-settings-categories', async () => {
    return db.getUserSettingsCategories();
  });

  ipcMain.handle('reset-setting-to-default', async (_, key: string) => {
    try {
      const success = db.resetSettingToDefault(key);
      return { success };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('reset-all-settings-to-default', async () => {
    try {
      const count = db.resetAllSettingsToDefault();
      return { success: true, count };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('import-settings', async (_, settings: any[]) => {
    try {
      const count = db.importSettings(settings);
      return { success: true, count };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('export-settings', async (_, categories?: string[]) => {
    try {
      const settings = db.exportSettings(categories);
      return { success: true, data: JSON.stringify(settings) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}

