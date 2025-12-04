import { ipcMain } from 'electron';
import DatabaseService from '../database/DatabaseService';
import crypto from 'crypto';

export function registerSecurityIpc(_db: DatabaseService) {
  ipcMain.handle('generate-password', async (_e, options: { length?: number; includeUppercase?: boolean; includeLowercase?: boolean; includeNumbers?: boolean; includeSymbols?: boolean; }) => {
    const length = Math.max(4, Math.min(128, options?.length ?? 16));
    const sets: string[] = [];
    if (options?.includeUppercase !== false) sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    if (options?.includeLowercase !== false) sets.push('abcdefghijklmnopqrstuvwxyz');
    if (options?.includeNumbers !== false) sets.push('0123456789');
    if (options?.includeSymbols) sets.push('!@#$%^&*()-_=+[]{};:,./?');
    const pool = sets.join('');
    if (!pool) return '';
    const reqSets = sets.length;
    const out: string[] = [];
    for (let i = 0; i < reqSets && out.length < length; i++) {
      const s = sets[i];
      const idx = crypto.randomInt(0, s.length);
      out.push(s[idx]);
    }
    while (out.length < length) {
      const idx = crypto.randomInt(0, pool.length);
      out.push(pool[idx]);
    }
    for (let i = out.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      const t = out[i];
      out[i] = out[j];
      out[j] = t;
    }
    return out.join('');
  });
}

