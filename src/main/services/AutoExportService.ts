import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type DatabaseService from '../database/DatabaseService';
import type { AutoExportConfig, AutoExportFrequency } from '../../shared/types';

export class AutoExportService {
  private db: DatabaseService;
  private win?: BrowserWindow | null;
  private nextTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor(db: DatabaseService, win?: BrowserWindow | null) {
    this.db = db;
    this.win = win;
  }

  public setWindow(win?: BrowserWindow | null): void {
    this.win = win;
  }

  public reload(): void {
    const config = this.readConfig();
    this.applyConfig(config);
  }

  private readConfig(): AutoExportConfig & { lastTime?: string } {
    const settings = this.db.getSettingsService();
    const enabled = settings.getTypedUserSetting<boolean>('backup.auto_export_enabled', false);
    const frequency = settings.getTypedUserSetting<AutoExportFrequency>('backup.auto_export_frequency', 'daily');
    const directory = settings.getTypedUserSetting<string>('backup.auto_export_directory', '');
    const format = settings.getTypedUserSetting<'json' | 'encrypted_zip'>('backup.auto_export_format', 'json');
    const archivePasswordSetting = settings.getTypedUserSetting<string>('backup.auto_export_password', '');
    const passwordFallback = settings.getTypedUserSetting<string>('exportDefaultPassword', '');
    const archivePassword = archivePasswordSetting || passwordFallback || undefined;
    const lastTime = settings.getTypedUserSetting<string>('backup.auto_export_last_time', '');
    return { enabled, frequency, directory, format, archivePassword, lastTime };
  }

  private applyConfig(config: AutoExportConfig & { lastTime?: string }): void {
    this.stopTimers();
    if (!config.enabled) return;
    if (!config.directory || config.directory.trim().length === 0) {
      console.warn('自动导出已开启，但未设置导出目录，已跳过计划任务');
      this.win?.webContents.send('auto-export-done', { success: false, error: '未设置自动导出目录' });
      return;
    }
    const interval = this.getIntervalMs(config.frequency);
    const last = config.lastTime ? Date.parse(config.lastTime) : 0;
    const now = Date.now();
    const wait = last > 0 ? Math.max(interval - (now - last), 0) : 0;
    const kickoff = async () => {
      await this.runOnce(config);
      this.intervalTimer = setInterval(() => { void this.runOnce(config); }, interval);
    };
    if (wait === 0) {
      void kickoff();
    } else {
      this.nextTimer = setTimeout(() => { void kickoff(); }, wait);
    }
  }

  private stopTimers(): void {
    if (this.nextTimer) clearTimeout(this.nextTimer);
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.nextTimer = null;
    this.intervalTimer = null;
  }

  private ensureDirectory(dir?: string): string {
    const targetDir = (dir && dir.trim().length > 0) ? dir : '';
    if (!targetDir) throw new Error('未设置自动导出目录，请先在设置中选择保存位置');
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (error) {
      console.error('创建自动导出目录失败', error);
      throw error;
    }
    return targetDir;
  }

  private getIntervalMs(freq: AutoExportFrequency): number {
    switch (freq) {
      case 'every_minute':
        return 60 * 1000;
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000;
      case 'daily':
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  private async runOnce(config: AutoExportConfig): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      if (config.format === 'encrypted_zip' && (!config.archivePassword || config.archivePassword.length < 4)) {
        throw new Error('自动导出为加密ZIP时需要至少4位的密码');
      }
      const targetDir = this.ensureDirectory(config.directory);
      const timestamp = this.formatTimestamp(new Date());
      const ext = config.format === 'encrypted_zip' ? 'zip' : 'json';
      const filePath = path.join(targetDir, `mylo_auto_backup_${timestamp}.${ext}`);
      const data = await this.db.exportData({
        format: config.format,
        includeGroups: true,
        includeHistory: true,
        includeSettings: true,
        archivePassword: config.format === 'encrypted_zip' ? config.archivePassword : undefined
      });
      fs.writeFileSync(filePath, Buffer.from(data));
      this.updateLastRun();
      this.win?.webContents.send('auto-export-done', { success: true, filePath });
      console.info('自动导出完成', filePath);
    } catch (error) {
      console.error('自动导出失败', error);
      this.win?.webContents.send('auto-export-done', { success: false, error: (error as Error).message });
    } finally {
      this.isRunning = false;
    }
  }

  private updateLastRun(): void {
    try {
      this.db.getSettingsService().updateUserSetting('backup.auto_export_last_time', new Date().toISOString());
    } catch (error) {
      console.warn('更新自动导出时间失败', error);
    }
  }

  private formatTimestamp(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }
}

export default AutoExportService;
