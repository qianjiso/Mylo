import type Database from 'better-sqlite3';
import { UserSetting, UserSettingsCategory } from '../../shared/types';

/**
 * 用户设置模块服务，负责设置的读取、保存、更新、删除与分组管理
 */
export class SettingsService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeDefaults();
  }

  /** 获取用户设置列表（可按类别过滤） */
  public getUserSettings(category?: string): UserSetting[] {
    let query = 'SELECT * FROM user_settings';
    const params: any[] = [];
    if (category) { query += ' WHERE category = ?'; params.push(category); }
    query += ' ORDER BY category, key';
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => ({
      id: row.id,
      key: row.key,
      value: row.value,
      type: row.type,
      category: row.category,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  /** 根据键获取单个设置 */
  public getUserSettingByKey(key: string): UserSetting | null {
    const row = this.db.prepare('SELECT * FROM user_settings WHERE key = ?').get(key) as any;
    if (!row) return null;
    return {
      id: row.id,
      key: row.key,
      value: row.value,
      type: row.type,
      category: row.category,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /** 保存或覆盖设置，保持 created_at 不变 */
  public saveUserSetting(setting: Omit<UserSetting, 'id' | 'created_at' | 'updated_at'>): boolean {
    this.validateUserSetting(setting);
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_settings (key, value, type, category, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM user_settings WHERE key = ?), ?), ?)
    `);
    const res = stmt.run(setting.key, setting.value, setting.type, setting.category, setting.description || null, setting.key, now, now);
    return res.changes > 0;
  }

  /** 更新设置的值 */
  public updateUserSetting(key: string, value: string): boolean {
    const res = this.db.prepare('UPDATE user_settings SET value = ?, updated_at = ? WHERE key = ?').run(value, new Date().toISOString(), key);
    return res.changes > 0;
  }

  /** 删除指定键的设置 */
  public deleteUserSetting(key: string): boolean {
    const res = this.db.prepare('DELETE FROM user_settings WHERE key = ?').run(key);
    return res.changes > 0;
  }

  /** 获取所有设置类别与包含的键 */
  public getUserSettingsCategories(): UserSettingsCategory[] {
    const rows = this.db.prepare(`
      SELECT category, GROUP_CONCAT(key, ',') as settings FROM user_settings GROUP BY category ORDER BY category
    `).all() as any[];
    return rows.map(r => ({ category: r.category, description: this.getCategoryDescription(r.category), settings: r.settings ? r.settings.split(',') : [] }));
  }

  /** 类型化读取设置值，解析失败返回默认 */
  public getTypedUserSetting<T>(key: string, defaultValue: T): T {
    const setting = this.getUserSettingByKey(key);
    if (!setting) return defaultValue;
    try {
      switch (setting.type) {
        case 'boolean': return (setting.value === 'true') as unknown as T;
        case 'number': return Number(setting.value) as unknown as T;
        case 'json': return JSON.parse(setting.value) as T;
        default: return setting.value as unknown as T;
      }
    } catch {
      return defaultValue;
    }
  }

  /** 导入设置列表（覆盖/创建），返回导入数量 */
  public importSettings(settings: UserSetting[]): number {
    let count = 0;
    const now = new Date().toISOString();
    const stmt = this.db.prepare('INSERT OR REPLACE INTO user_settings (key, value, type, category, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const s of settings) {
      try {
        stmt.run(s.key, s.value, s.type || 'string', s.category || 'general', s.description || null, s.created_at || now, now);
        count++;
      } catch {
        count += 0;
      }
    }
    return count;
  }

  /** 导出设置（可按类别筛选） */
  public exportSettings(categories?: string[]): UserSetting[] {
    let query = 'SELECT * FROM user_settings';
    const params: any[] = [];
    if (categories && categories.length > 0) {
      const placeholders = categories.map(() => '?').join(',');
      query += ` WHERE category IN (${placeholders})`;
      params.push(...categories);
    }
    query += ' ORDER BY category, key';
    return this.db.prepare(query).all(...params) as UserSetting[];
  }

  /** 将指定键重置为默认值 */
  public resetSettingToDefault(key: string): boolean {
    const defaults = this.getDefaultSettings();
    const def = defaults.find(s => s.key === key);
    if (!def) return false;
    return this.updateUserSetting(key, def.value);
  }

  /** 重置所有设置为默认值，返回重置数量 */
  public resetAllSettingsToDefault(): number {
    const defaults = this.getDefaultSettings();
    let reset = 0;
    for (const s of defaults) {
      if (this.updateUserSetting(s.key, s.value)) reset++;
    }
    return reset;
  }

  /** 验证设置对象的字段合法性 */
  public validateUserSetting(setting: UserSetting): void {
    if (!setting.key || setting.key.trim().length === 0) throw new Error('设置键名不能为空');
    if (setting.key.length > 100) throw new Error('设置键名长度不能超过100个字符');
    const keyPattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
    if (!keyPattern.test(setting.key)) throw new Error('设置键名格式不正确，应使用小写字母、数字、下划线和点');
    if (!setting.value && setting.value !== '0') throw new Error('设置值不能为空');
    if (setting.value.length > 10000) throw new Error('设置值长度不能超过10000个字符');
    const validTypes = ['string', 'number', 'boolean', 'json'];
    if (setting.type && !validTypes.includes(setting.type)) throw new Error('无效的设置类型');
    const validCategories = ['security', 'ui', 'general', 'backup', 'sync'];
    if (setting.category && !validCategories.includes(setting.category)) throw new Error('无效的设置类别');
  }

  /** 初始化默认设置（仅在缺失时插入） */
  private initializeDefaults(): void {
    const defaults = this.getDefaultSettings();
    const now = new Date().toISOString();
    const stmt = this.db.prepare('INSERT OR IGNORE INTO user_settings (key, value, type, category, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const s of defaults) {
      stmt.run(s.key, s.value, s.type, s.category, s.description, now, now);
    }
  }

  /** 获取设置类别描述文案 */
  public getCategoryDescription(category: string): string {
    const desc: { [key: string]: string } = {
      security: '安全相关设置，包括密码生成器、自动锁定等',
      ui: '界面相关设置，包括主题、语言、显示选项等',
      general: '通用设置',
      backup: '备份和恢复相关设置',
      sync: '同步相关设置'
    };
    return desc[category] || '其他设置';
  }

  /** 默认设置清单 */
  public getDefaultSettings(): Array<Omit<UserSetting, 'id' | 'created_at' | 'updated_at'>> {
    return [
      { key: 'security.auto_lock_timeout', value: '300', type: 'number', category: 'security', description: '自动锁定时间（秒）' },
      { key: 'security.password_generator_length', value: '16', type: 'number', category: 'security', description: '密码生成器默认长度' },
      { key: 'security.password_generator_include_uppercase', value: 'true', type: 'boolean', category: 'security', description: '密码生成器包含大写字母' },
      { key: 'security.password_generator_include_lowercase', value: 'true', type: 'boolean', category: 'security', description: '密码生成器包含小写字母' },
      { key: 'security.password_generator_include_numbers', value: 'true', type: 'boolean', category: 'security', description: '密码生成器包含数字' },
      { key: 'security.password_generator_include_symbols', value: 'true', type: 'boolean', category: 'security', description: '密码生成器包含特殊字符' },
      { key: 'security.clipboard_clear_timeout', value: '30', type: 'number', category: 'security', description: '剪贴板自动清除时间（秒）' },
      { key: 'ui.theme', value: 'light', type: 'string', category: 'ui', description: '界面主题（light/dark/auto）' },
      { key: 'ui.language', value: 'zh-CN', type: 'string', category: 'ui', description: '界面语言' },
      { key: 'ui.default_group_color', value: 'blue', type: 'string', category: 'ui', description: '默认分组颜色' },
      { key: 'ui.show_password_strength', value: 'true', type: 'boolean', category: 'ui', description: '显示密码强度指示器' }
    ];
  }
}

export default SettingsService;
