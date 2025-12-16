import { ipcMain } from 'electron';
import DatabaseService from '../database/DatabaseService';
import { logError, logWarn } from '../logger';

export function registerSettingsIpc(db: DatabaseService, options?: { onChanged?: () => void }) {
  const notifyChange = () => {
    try {
      options?.onChanged?.();
    } catch (error) {
      logWarn('SETTINGS_CHANGE_CALLBACK_FAILED', '设置变更回调失败', { error: error instanceof Error ? error.message : String(error) });
    }
  };
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
      if (success) notifyChange();
      return { success };
    } catch (error) {
      logError('IPC_SET_USER_SETTING_FAILED', 'set-user-setting failed', error instanceof Error ? error : undefined, { key });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('update-user-setting', async (_, key: string, value: string) => {
    try {
      const success = db.updateUserSetting(key, value);
      if (success) notifyChange();
      return { success };
    } catch (error) {
      logError('IPC_UPDATE_USER_SETTING_FAILED', 'update-user-setting failed', error instanceof Error ? error : undefined, { key });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('delete-user-setting', async (_, key: string) => {
    try {
      const success = db.deleteUserSetting(key);
      if (success) notifyChange();
      return { success };
    } catch (error) {
      logError('IPC_DELETE_USER_SETTING_FAILED', 'delete-user-setting failed', error instanceof Error ? error : undefined, { key });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('get-user-settings-categories', async () => {
    return db.getUserSettingsCategories();
  });

  ipcMain.handle('reset-setting-to-default', async (_, key: string) => {
    try {
      const success = db.resetSettingToDefault(key);
      if (success) notifyChange();
      return { success };
    } catch (error) {
      logError('IPC_RESET_SETTING_TO_DEFAULT_FAILED', 'reset-setting-to-default failed', error instanceof Error ? error : undefined, { key });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('reset-all-settings-to-default', async () => {
    try {
      const count = db.resetAllSettingsToDefault();
      if (count > 0) notifyChange();
      return { success: true, count };
    } catch (error) {
      logError('IPC_RESET_ALL_SETTINGS_TO_DEFAULT_FAILED', 'reset-all-settings-to-default failed', error instanceof Error ? error : undefined);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('import-settings', async (_, settings: any[]) => {
    try {
      const count = db.importSettings(settings);
      if (count > 0) notifyChange();
      return { success: true, count };
    } catch (error) {
      logError('IPC_IMPORT_SETTINGS_FAILED', 'import-settings failed', error instanceof Error ? error : undefined);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('export-settings', async (_, categories?: string[]) => {
    try {
      const settings = db.exportSettings(categories);
      return { success: true, data: JSON.stringify(settings) };
    } catch (error) {
      logError('IPC_EXPORT_SETTINGS_FAILED', 'export-settings failed', error instanceof Error ? error : undefined);
      return { success: false, error: (error as Error).message };
    }
  });
}
