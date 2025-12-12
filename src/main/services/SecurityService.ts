import crypto from 'crypto';
import type Database from 'better-sqlite3';
import SettingsService from './SettingsService';
import type { MasterPasswordState } from '../../shared/types';

/**
 * 负责主密码的设置、验证与开关控制。
 * 当前版本仅用于访问控制，不替换已有数据加密密钥。
 */
export default class SecurityService {
  private db: Database.Database;
  private settings: SettingsService;

  constructor(db: Database.Database, settings: SettingsService) {
    this.db = db;
    this.settings = settings;
  }

  /** 获取主密码状态和锁定配置 */
  public getState(): MasterPasswordState {
    const requireSetting = this.settings.getUserSettingByKey('security.require_master_password');
    const salt = this.settings.getUserSettingByKey('security.master_password_salt');
    const hash = this.settings.getUserSettingByKey('security.master_password_hash');
    const hint = this.settings.getUserSettingByKey('security.master_password_hint');
    const lastUnlock = this.settings.getUserSettingByKey('security.last_unlock_at');
    const autoLockSeconds = this.settings.getTypedUserSetting<number>('security.auto_lock_timeout', 300);
    return {
      hasMasterPassword: !!(salt && hash),
      requireMasterPassword: requireSetting ? requireSetting.value === 'true' : false,
      hint: hint?.value || '',
      autoLockMinutes: Math.max(1, Math.round(autoLockSeconds / 60)),
      lastUnlockAt: lastUnlock?.value || ''
    };
  }

  /** 设置或重置主密码 */
  public setMasterPassword(password: string, hint?: string): boolean {
    if (!password || password.length < 6) {
      throw new Error('主密码长度至少为6位');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPassword(password, salt);
    const now = new Date().toISOString();
    const payload = [
      { key: 'security.master_password_salt', value: salt, type: 'string', category: 'security', description: '主密码盐值' },
      { key: 'security.master_password_hash', value: hash, type: 'string', category: 'security', description: '主密码校验哈希' },
      { key: 'security.master_password_hint', value: hint || '', type: 'string', category: 'security', description: '主密码提示' },
      { key: 'security.require_master_password', value: 'true', type: 'boolean', category: 'security', description: '是否开启主密码' }
    ];
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_settings (key, value, type, category, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM user_settings WHERE key = ?), ?), ?)
    `);
    for (const item of payload) {
      stmt.run(item.key, item.value, item.type, item.category, item.description, item.key, now, now);
    }
    this.touchUnlock();
    return true;
  }

  /** 验证主密码是否正确 */
  public verifyMasterPassword(password: string): boolean {
    const { salt, hash } = this.getMasterSecret();
    if (!salt || !hash) return false;
    const calc = this.hashPassword(password, salt);
    const ok = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calc, 'hex'));
    if (ok) this.touchUnlock();
    return ok;
  }

  /** 更新主密码（需要旧密码验证） */
  public updateMasterPassword(currentPassword: string, newPassword: string, hint?: string): boolean {
    if (!this.verifyMasterPassword(currentPassword)) {
      throw new Error('当前主密码不正确');
    }
    return this.setMasterPassword(newPassword, hint);
  }

  /** 关闭主密码，需验证旧密码 */
  public clearMasterPassword(currentPassword: string): boolean {
    if (!this.verifyMasterPassword(currentPassword)) {
      throw new Error('当前主密码不正确');
    }
    const stmt = this.db.prepare('DELETE FROM user_settings WHERE key IN (?, ?, ?, ?)');
    stmt.run(
      'security.master_password_salt',
      'security.master_password_hash',
      'security.master_password_hint',
      'security.require_master_password'
    );
    return true;
  }

  /** 设置是否强制主密码 */
  public setRequireMasterPassword(require: boolean): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_settings (key, value, type, category, description, created_at, updated_at)
      VALUES ('security.require_master_password', ?, 'boolean', 'security', '是否开启主密码', COALESCE((SELECT created_at FROM user_settings WHERE key = 'security.require_master_password'), ?), ?)
    `);
    stmt.run(require ? 'true' : 'false', now, now);
    return true;
  }

  private getMasterSecret(): { salt: string | null; hash: string | null } {
    const salt = this.settings.getUserSettingByKey('security.master_password_salt');
    const hash = this.settings.getUserSettingByKey('security.master_password_hash');
    return { salt: salt?.value || null, hash: hash?.value || null };
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 10000, 32, 'sha256').toString('hex');
  }

  private touchUnlock(): void {
    const now = new Date().toISOString();
    this.settings.saveUserSetting({
      key: 'security.last_unlock_at',
      value: now,
      type: 'string',
      category: 'security',
      description: '最近一次解锁时间'
    });
  }
}
