import { ipcMain } from 'electron';
import crypto from 'crypto';
import DatabaseService from '../database/DatabaseService';
import SecurityService from '../services/SecurityService';

export function registerSecurityIpc(_db: DatabaseService, securityService: SecurityService) {
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

  ipcMain.handle('security-get-state', async () => {
    return securityService.getState();
  });

  ipcMain.handle('security-set-master-password', async (_e, payload: { password: string; hint?: string }) => {
    try {
      securityService.setMasterPassword(payload.password, payload.hint);
      return { success: true, state: securityService.getState() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '设置主密码失败';
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('security-verify-master-password', async (_e, password: string) => {
    try {
      const ok = securityService.verifyMasterPassword(password);
      return { success: ok, state: securityService.getState(), error: ok ? undefined : '主密码不正确' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '验证失败';
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('security-update-master-password', async (_e, payload: { currentPassword: string; newPassword: string; hint?: string }) => {
    try {
      securityService.updateMasterPassword(payload.currentPassword, payload.newPassword, payload.hint);
      return { success: true, state: securityService.getState() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '更新主密码失败';
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('security-clear-master-password', async (_e, currentPassword: string) => {
    try {
      securityService.clearMasterPassword(currentPassword);
      return { success: true, state: securityService.getState() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '关闭主密码失败';
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('security-set-require-master-password', async (_e, require: boolean) => {
    try {
      securityService.setRequireMasterPassword(require);
      return { success: true, state: securityService.getState() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '更新主密码设置失败';
      return { success: false, error: msg };
    }
  });
}
