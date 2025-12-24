import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type DatabaseService from '../database/DatabaseService';
import type { AutoExportConfig, AutoExportFrequency } from '../../shared/types';
import { logError, logInfo } from '../logger';

export class AutoExportService {
  private db: DatabaseService;
  private win?: BrowserWindow | null;
  private nextTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastScheduleSignature: string | null = null;
  private lastEnabled: boolean | null = null;
  private static readonly FIRST_RUN_DELAY_MS = 5 * 1000;

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
    const timeOfDay = settings.getTypedUserSetting<string>('backup.auto_export_time_of_day', '02:00');
    const dayOfWeek = settings.getTypedUserSetting<number>('backup.auto_export_day_of_week', 1);
    const dayOfMonth = settings.getTypedUserSetting<number>('backup.auto_export_day_of_month', 1);
    const intervalMinutes = settings.getTypedUserSetting<number>('backup.auto_export_interval_minutes', 60);
    return { enabled, frequency, directory, format, archivePassword, lastTime, timeOfDay, dayOfWeek, dayOfMonth, intervalMinutes };
  }

  private applyConfig(config: AutoExportConfig & { lastTime?: string }): void {
    this.stopTimers();
    if (!config.enabled) {
      if (this.lastEnabled) {
        logInfo('AUTO_EXPORT_DISABLED', '自动导出已关闭');
      }
      this.lastEnabled = false;
      this.lastScheduleSignature = null;
      return;
    }
    this.lastEnabled = true;
    if (!config.directory || config.directory.trim().length === 0) {
      this.win?.webContents.send('auto-export-done', { success: false, error: '未设置自动导出目录' });
      return;
    }
    const nowMs = Date.now();
    const hasLastRun = !!config.lastTime;
    const nextMs = this.computeNextRunTime(config, nowMs);
    const delay = hasLastRun
      ? Math.max(nextMs - nowMs, AutoExportService.FIRST_RUN_DELAY_MS)
      : AutoExportService.FIRST_RUN_DELAY_MS; // 首次开启时尽快执行，避免用户感知“无任务”
    const scheduleSignature = this.buildScheduleSignature(config);
    if (this.lastScheduleSignature !== scheduleSignature) {
      logInfo('AUTO_EXPORT_SCHEDULED', '自动导出计划已安排', {
        enabled: config.enabled,
        frequency: config.frequency,
        directory: config.directory,
        format: config.format,
        hasPassword: !!config.archivePassword,
        lastTime: config.lastTime,
        delayMs: delay,
      });
    }
    this.lastScheduleSignature = scheduleSignature;
    this.nextTimer = setTimeout(() => {
      void this.runOnce(config).finally(() => {
        // 任务执行完成后重新读取配置并重新计算下一次运行时间
        this.reload();
      });
    }, delay);
  }

  private stopTimers(): void {
    if (this.nextTimer) clearTimeout(this.nextTimer);
    this.nextTimer = null;
  }

  private buildScheduleSignature(config: AutoExportConfig): string {
    return JSON.stringify({
      enabled: config.enabled,
      frequency: config.frequency,
      directory: config.directory,
      format: config.format,
      hasPassword: !!config.archivePassword,
      timeOfDay: config.timeOfDay,
      dayOfWeek: config.dayOfWeek,
      dayOfMonth: config.dayOfMonth,
      intervalMinutes: config.intervalMinutes,
    });
  }

  private ensureDirectory(dir?: string): string {
    const targetDir = (dir && dir.trim().length > 0) ? dir : '';
    if (!targetDir) throw new Error('未设置自动导出目录，请先在设置中选择保存位置');
    fs.mkdirSync(targetDir, { recursive: true });
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

  /** 计算下一次执行时间（毫秒时间戳） */
  private computeNextRunTime(config: AutoExportConfig & { lastTime?: string }, nowMs: number): number {
    const now = new Date(nowMs);
    const lastMs = config.lastTime ? Date.parse(config.lastTime) : 0;
    const safeLastMs = Number.isFinite(lastMs) ? lastMs : 0;

    if (config.frequency === 'every_minute') {
      const intervalMin = config.intervalMinutes && config.intervalMinutes > 0 ? config.intervalMinutes : 60;
      const base = safeLastMs > 0 ? safeLastMs : nowMs;
      return base + intervalMin * 60 * 1000;
    }

    const { hours, minutes } = this.parseTimeOfDay(config.timeOfDay);

    if (config.frequency === 'daily') {
      const candidate = new Date(nowMs);
      candidate.setHours(hours, minutes, 0, 0);
      let ts = candidate.getTime();
      if (ts <= nowMs || ts <= safeLastMs) {
        candidate.setDate(candidate.getDate() + 1);
        ts = candidate.getTime();
      }
      return ts;
    }

    if (config.frequency === 'weekly') {
      const targetDow = config.dayOfWeek && config.dayOfWeek >= 1 && config.dayOfWeek <= 7 ? config.dayOfWeek : 1;
      // 将 JS 的星期（0=周日）转换为 1=周一 ... 7=周日
      const jsDow = now.getDay(); // 0-6, 0=周日
      const currentDow = jsDow === 0 ? 7 : jsDow; // 1-7
      let diff = targetDow - currentDow;
      if (diff < 0) diff += 7;
      const candidate = new Date(nowMs);
      candidate.setDate(candidate.getDate() + diff);
      candidate.setHours(hours, minutes, 0, 0);
      let ts = candidate.getTime();
      if (ts <= nowMs || ts <= safeLastMs) {
        candidate.setDate(candidate.getDate() + 7);
        ts = candidate.getTime();
      }
      return ts;
    }

    // monthly
    const day = config.dayOfMonth && config.dayOfMonth >= 1 && config.dayOfMonth <= 31 ? config.dayOfMonth : 1;
    const candidate = this.makeMonthlyCandidate(now, day, hours, minutes);
    let ts = candidate.getTime();
    if (ts <= nowMs || ts <= safeLastMs) {
      const nextMonth = new Date(nowMs);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const nextCandidate = this.makeMonthlyCandidate(nextMonth, day, hours, minutes);
      ts = nextCandidate.getTime();
    }
    return ts;
  }

  private parseTimeOfDay(raw?: string): { hours: number; minutes: number } {
    if (!raw) return { hours: 2, minutes: 0 };
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(raw.trim());
    if (!m) return { hours: 2, minutes: 0 };
    let h = Number(m[1]);
    let mm = Number(m[2]);
    if (!Number.isFinite(h) || h < 0 || h > 23) h = 2;
    if (!Number.isFinite(mm) || mm < 0 || mm > 59) mm = 0;
    return { hours: h, minutes: mm };
  }

  private makeMonthlyCandidate(base: Date, day: number, hours: number, minutes: number): Date {
    const y = base.getFullYear();
    const m = base.getMonth(); // 0-11
    const lastDay = new Date(y, m + 1, 0).getDate();
    const realDay = Math.min(day, lastDay);
    return new Date(y, m, realDay, hours, minutes, 0, 0);
  }

  private async runOnce(config: AutoExportConfig): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      logInfo('AUTO_EXPORT_START', '自动导出开始执行', {
        format: config.format,
        frequency: config.frequency,
      });
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
      logInfo('AUTO_EXPORT_SUCCESS', '自动导出完成', { filePath });
    } catch (error) {
      logError('AUTO_EXPORT_FAILED', '自动导出失败', error instanceof Error ? error : undefined, {
        directory: config.directory,
        format: config.format,
      });
      this.win?.webContents.send('auto-export-done', { success: false, error: (error as Error).message });
    } finally {
      this.isRunning = false;
    }
  }

  private updateLastRun(): void {
    try {
      this.db.getSettingsService().updateUserSetting('backup.auto_export_last_time', new Date().toISOString());
    } catch {
      // ignore update last run time error
    }
  }

  private formatTimestamp(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }
}

export default AutoExportService;
