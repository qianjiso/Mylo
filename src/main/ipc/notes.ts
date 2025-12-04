import { ipcMain } from 'electron';
import DatabaseService from '../database/DatabaseService';

export function registerNotesIpc(db: DatabaseService) {
  ipcMain.handle('get-note-groups', async () => {
    return db.getNoteGroups();
  });

  ipcMain.handle('get-note-group-tree', async (_, parentId?: number) => {
    return db.getNoteGroupTree(parentId);
  });

  ipcMain.handle('add-note-group', async (_, group) => {
    try {
      const id = db.saveNoteGroup(group);
      return { success: true, id };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('update-note-group', async (_, id, group) => {
    try {
      const updated = { ...group, id };
      db.saveNoteGroup(updated);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('delete-note-group', async (_, id) => {
    const success = db.deleteNoteGroup(id);
    return { success };
  });

  ipcMain.handle('get-notes', async (_, groupId?: number) => {
    return db.getNotes(groupId);
  });

  ipcMain.handle('get-note', async (_, id: number) => {
    return db.getNoteById(id);
  });

  ipcMain.handle('add-note', async (_, note) => {
    try {
      const id = db.saveNote(note);
      return { success: true, id };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('update-note', async (_, id, note) => {
    try {
      const updated = { ...note, id };
      db.saveNote(updated);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('delete-note', async (_, id) => {
    const success = db.deleteNote(id);
    return { success };
  });

  ipcMain.handle('search-notes-title', async (_, keyword: string) => {
    return db.searchNotesByTitle(keyword);
  });
}

