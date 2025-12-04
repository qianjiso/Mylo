import { ipcMain } from 'electron';
import DatabaseService from '../database/DatabaseService';

export function registerGroupIpc(db: DatabaseService) {
  ipcMain.handle('get-groups', async () => {
    return db.getGroups();
  });

  ipcMain.handle('get-group-tree', async (_, parentId?: number) => {
    return db.getGroupWithChildren(parentId);
  });

  ipcMain.handle('add-group', async (_, group) => {
    try {
      const id = db.saveGroup(group);
      return { success: true, id };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('update-group', async (_, id, group) => {
    try {
      const updatedGroup = { ...group, id };
      db.saveGroup(updatedGroup);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('delete-group', async (_, id) => {
    const success = db.deleteGroup(id);
    return { success };
  });

  ipcMain.handle('get-group-by-id', async (_, id: number) => {
    return db.getGroupById(id);
  });

  ipcMain.handle('get-group-by-name', async (_, name: string, parentId?: number) => {
    return db.getGroupByName(name, parentId);
  });
}

