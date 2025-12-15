import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import GroupService from '../services/GroupService';
import PasswordService from '../services/PasswordService';
import SettingsService from '../services/SettingsService';
import NoteService from '../services/NoteService';
import { Group, GroupWithChildren, PasswordItem, PasswordHistory, UserSetting, UserSettingsCategory, SecureRecord, SecureRecordGroup } from '../../shared/types';
import { createCrypto } from '../../shared/security/crypto';
import BackupService from '../services/BackupService';
import IntegrityService from '../services/IntegrityService';
import SecurityService from '../services/SecurityService';
 

export class DatabaseService {
  private db: Database.Database | null = null;
  private encryptionKey: string;
  private groupService!: GroupService;
  private passwordService!: PasswordService;
  private settingsService!: SettingsService;
  private noteService!: NoteService;
  private cryptoAdapter!: { encrypt: (text: string) => string; decrypt: (text: string) => string };
  private backupService!: BackupService;
  private integrityService!: IntegrityService;
  private securityService!: SecurityService;

  constructor() {
    // 从环境变量或默认值获取加密密钥
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars-long';
    
    try {
      this.initializeDatabase();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private initializeDatabase(): void {
    const dbPath = path.join(app.getPath('userData'), 'passwords.db');
    
    try {
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.createTables();
      // 初始化三大模块服务
      this.cryptoAdapter = createCrypto(this.encryptionKey);
      this.groupService = new GroupService(this.db);
      this.passwordService = new PasswordService(this.db, this.cryptoAdapter);
      this.settingsService = new SettingsService(this.db);
      this.noteService = new NoteService(this.db, this.cryptoAdapter);
      this.backupService = new BackupService(this.db, this.cryptoAdapter, this.groupService, this.passwordService, this.settingsService, this.noteService);
      this.integrityService = new IntegrityService(this.db);
      this.securityService = new SecurityService(this.db, this.settingsService);
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // 创建用户设置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'string',
        category TEXT NOT NULL DEFAULT 'general',
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 创建分组表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER,
        color TEXT DEFAULT 'blue',
        order_index INTEGER NOT NULL DEFAULT 0,
        sort INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES groups (id) ON DELETE CASCADE
      )
    `);

    // 创建密码表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS passwords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT,
        url TEXT,
        notes TEXT,
        multi_accounts TEXT,
        group_id INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE SET NULL
      )
    `);

    // 创建密码历史表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS password_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        password_id INTEGER NOT NULL,
        old_password TEXT NOT NULL,
        new_password TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        changed_reason TEXT,
        FOREIGN KEY (password_id) REFERENCES passwords (id) ON DELETE CASCADE
      )
    `);

    this.ensureGroupOrderColumn();
    this.ensureGroupSortColumn();
    this.ensurePasswordNullableColumn();

    // 创建索引
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(key);
      CREATE INDEX IF NOT EXISTS idx_user_settings_category ON user_settings(category);
      CREATE INDEX IF NOT EXISTS idx_groups_parent_id ON groups(parent_id);
      CREATE INDEX IF NOT EXISTS idx_groups_order ON groups(parent_id, order_index);
      CREATE INDEX IF NOT EXISTS idx_groups_sort ON groups(parent_id, sort);
      CREATE INDEX IF NOT EXISTS idx_passwords_group_id ON passwords(group_id);
      CREATE INDEX IF NOT EXISTS idx_password_history_password_id ON password_history(password_id);
      CREATE INDEX IF NOT EXISTS idx_passwords_updated_at ON passwords(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_passwords_created_at ON passwords(created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_name_parent ON groups(name, parent_id);
    `);

    // 创建全文搜索虚拟表（FTS5）
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS passwords_fts USING fts5(
        title, 
        username, 
        url, 
        notes,
        content='passwords',
        content_rowid='id'
      );
    `);

    // 创建FTS触发器，保持搜索索引同步
    this.db.exec(`
      -- 插入触发器
      CREATE TRIGGER IF NOT EXISTS passwords_fts_insert AFTER INSERT ON passwords BEGIN
        INSERT INTO passwords_fts(rowid, title, username, url, notes)
        VALUES (new.id, new.title, new.username, new.url, new.notes);
      END;
      
      -- 更新触发器
      CREATE TRIGGER IF NOT EXISTS passwords_fts_update AFTER UPDATE ON passwords BEGIN
        UPDATE passwords_fts SET 
          title = new.title,
          username = new.username,
          url = new.url,
          notes = new.notes
        WHERE rowid = new.id;
      END;
      
      -- 删除触发器
      CREATE TRIGGER IF NOT EXISTS passwords_fts_delete AFTER DELETE ON passwords BEGIN
        DELETE FROM passwords_fts WHERE rowid = old.id;
      END;
    `);

    // 初始化默认设置
    this.initializeDefaultSettings();

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS secure_record_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER,
        color TEXT DEFAULT 'blue',
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS secure_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content_ciphertext TEXT NOT NULL,
        group_id INTEGER,
        pinned INTEGER DEFAULT 0,
        archived INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_secure_record_groups_parent ON secure_record_groups(parent_id);
      CREATE INDEX IF NOT EXISTS idx_secure_record_groups_sort ON secure_record_groups(parent_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_secure_records_group ON secure_records(group_id);
      CREATE INDEX IF NOT EXISTS idx_secure_records_updated ON secure_records(updated_at DESC);
    `);
  }

  private encrypt(text: string): string {
    return this.cryptoAdapter.encrypt(text);
  }

  private decrypt(encryptedText: string): string {
    return this.cryptoAdapter.decrypt(encryptedText);
  }
  public getSecurityService(): SecurityService {
    return this.securityService;
  }
  public getSettingsService(): SettingsService {
    return this.settingsService;
  }

  // 初始化默认设置
  private initializeDefaultSettings(): void {
    if (!this.db) throw new Error('Database not initialized');

    const defaultSettings = [
      {
        key: 'security.auto_lock_timeout',
        value: '300',
        type: 'number',
        category: 'security',
        description: '自动锁定时间（秒）'
      },
      {
        key: 'security.password_generator_length',
        value: '16',
        type: 'number',
        category: 'security',
        description: '密码生成器默认长度'
      },
      {
        key: 'security.require_master_password',
        value: 'false',
        type: 'boolean',
        category: 'security',
        description: '是否开启主密码'
      },
      {
        key: 'security.password_generator_include_symbols',
        value: 'true',
        type: 'boolean',
        category: 'security',
        description: '密码生成器包含特殊字符'
      },
      {
        key: 'security.clipboard_clear_timeout',
        value: '30',
        type: 'number',
        category: 'security',
        description: '剪贴板自动清除时间（秒）'
      },
      {
        key: 'ui.theme',
        value: 'light',
        type: 'string',
        category: 'ui',
        description: '界面主题（light/dark/auto）'
      },
      {
        key: 'ui.language',
        value: 'zh-CN',
        type: 'string',
        category: 'ui',
        description: '界面语言'
      },
      {
        key: 'ui.default_group_color',
        value: 'blue',
        type: 'string',
        category: 'ui',
        description: '默认分组颜色'
      },
      {
        key: 'ui.show_password_strength',
        value: 'true',
        type: 'boolean',
        category: 'ui',
        description: '显示密码强度指示器'
      },
      {
        key: 'backup.auto_export_enabled',
        value: 'false',
        type: 'boolean',
        category: 'backup',
        description: '是否开启自动导出'
      },
      {
        key: 'backup.auto_export_frequency',
        value: 'daily',
        type: 'string',
        category: 'backup',
        description: '自动导出频率'
      },
      {
        key: 'backup.auto_export_time_of_day',
        value: '02:00',
        type: 'string',
        category: 'backup',
        description: '自动导出时间（每日/每周/每月，格式 HH:mm）'
      },
      {
        key: 'backup.auto_export_day_of_week',
        value: '1',
        type: 'number',
        category: 'backup',
        description: '自动导出周几（1=周一 ... 7=周日）'
      },
      {
        key: 'backup.auto_export_day_of_month',
        value: '1',
        type: 'number',
        category: 'backup',
        description: '自动导出日期（1-31）'
      },
      {
        key: 'backup.auto_export_interval_minutes',
        value: '60',
        type: 'number',
        category: 'backup',
        description: '自动导出间隔（分钟，every_minute 模式）'
      },
      {
        key: 'backup.auto_export_directory',
        value: '',
        type: 'string',
        category: 'backup',
        description: '自动导出目录'
      },
      {
        key: 'backup.auto_export_format',
        value: 'json',
        type: 'string',
        category: 'backup',
        description: '自动导出格式'
      },
      {
        key: 'backup.auto_export_password',
        value: '',
        type: 'string',
        category: 'backup',
        description: '自动导出压缩包密码'
      },
      {
        key: 'backup.auto_export_last_time',
        value: '',
        type: 'string',
        category: 'backup',
        description: '上次自动导出时间'
      }
    ];

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO user_settings (key, value, type, category, description, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const setting of defaultSettings) {
      stmt.run(
        setting.key,
        setting.value,
        setting.type,
        setting.category,
        setting.description,
        now,
        now
      );
    }
  }

  private ensureGroupOrderColumn(): void {
    if (!this.db) throw new Error('Database not initialized');

    const columns = this.db.prepare('PRAGMA table_info(groups)').all() as Array<{ name: string }>;
    const hasOrderIndex = columns.some(column => column.name === 'order_index');

    if (!hasOrderIndex) {
      this.db.prepare('ALTER TABLE groups ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0').run();
      this.recalculateGroupOrder();
    }
  }

  private recalculateGroupOrder(): void {
    if (!this.db) throw new Error('Database not initialized');

    const groups = this.db.prepare('SELECT id, parent_id FROM groups ORDER BY created_at ASC').all() as Array<{ id: number; parent_id?: number }>;
    const parentCounters = new Map<number | null, number>();
    const updateOrder = this.db.prepare('UPDATE groups SET order_index = ? WHERE id = ?');
    const updateSort = this.db.prepare('UPDATE groups SET sort = ? WHERE id = ?');

    for (const group of groups) {
      const parentKey = group.parent_id ?? null;
      const currentIndex = parentCounters.get(parentKey) ?? 0;
      updateOrder.run(currentIndex, group.id);
      updateSort.run(currentIndex, group.id);
      parentCounters.set(parentKey, currentIndex + 1);
    }
  }

  private ensureGroupSortColumn(): void {
    const columns = this.db!.prepare('PRAGMA table_info(groups)').all() as Array<{ name: string }>;
    const hasSort = columns.some(column => column.name === 'sort');
    if (!hasSort) {
      this.db!.prepare('ALTER TABLE groups ADD COLUMN sort INTEGER NOT NULL DEFAULT 0').run();
      this.db!.prepare('UPDATE groups SET sort = order_index').run();
    }
  }

  private getNextGroupSort(parentId?: number): number {
    const row = parentId == null
      ? this.db!.prepare('SELECT COALESCE(MAX(sort), -1) AS max_sort FROM groups WHERE parent_id IS NULL').get() as { max_sort: number }
      : this.db!.prepare('SELECT COALESCE(MAX(sort), -1) AS max_sort FROM groups WHERE parent_id = ?').get(parentId) as { max_sort: number };
    return (row.max_sort ?? -1) + 1;
  }

  private ensurePasswordNullableColumn(): void {
    const columns = this.db!.prepare('PRAGMA table_info(passwords)').all() as Array<{ name: string; notnull: number }>;
    const passwordCol = columns.find(c => c.name === 'password');
    if (passwordCol && passwordCol.notnull === 1) {
      this.db!.exec('BEGIN');
      try {
        this.db!.exec(`
          CREATE TABLE IF NOT EXISTS passwords_migrated (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            username TEXT NOT NULL,
            password TEXT,
            url TEXT,
            notes TEXT,
            multi_accounts TEXT,
            group_id INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE SET NULL
          )
        `);

        this.db!.exec(`
          INSERT INTO passwords_migrated (id, title, username, password, url, notes, multi_accounts, group_id, created_at, updated_at)
          SELECT id, title, username, password, url, notes, multi_accounts, group_id, created_at, updated_at FROM passwords
        `);

        this.db!.exec('DROP TABLE passwords');
        this.db!.exec('ALTER TABLE passwords_migrated RENAME TO passwords');

        // 触发器可能需要重新创建
        this.db!.exec(`
          DROP TRIGGER IF EXISTS passwords_fts_insert;
          DROP TRIGGER IF EXISTS passwords_fts_update;
          DROP TRIGGER IF EXISTS passwords_fts_delete;
        `);

        this.db!.exec(`
          CREATE TRIGGER IF NOT EXISTS passwords_fts_insert AFTER INSERT ON passwords BEGIN
            INSERT INTO passwords_fts(rowid, title, username, url, notes)
            VALUES (new.id, new.title, new.username, new.url, new.notes);
          END;
        `);
        this.db!.exec(`
          CREATE TRIGGER IF NOT EXISTS passwords_fts_update AFTER UPDATE ON passwords BEGIN
            UPDATE passwords_fts SET 
              title = new.title,
              username = new.username,
              url = new.url,
              notes = new.notes
            WHERE rowid = new.id;
          END;
        `);
        this.db!.exec(`
          CREATE TRIGGER IF NOT EXISTS passwords_fts_delete AFTER DELETE ON passwords BEGIN
            DELETE FROM passwords_fts WHERE rowid = old.id;
          END;
        `);

        this.db!.exec('COMMIT');
      } catch (e) {
        this.db!.exec('ROLLBACK');
      }
    }
  }

  private getNextGroupOrder(parentId?: number): number {
    if (!this.db) throw new Error('Database not initialized');
    const parentKey = parentId ?? null;

    if (parentKey === null) {
      const row = this.db.prepare('SELECT COALESCE(MAX(order_index), -1) as max_index FROM groups WHERE parent_id IS NULL').get() as { max_index: number };
      return row.max_index + 1;
    }

    const row = this.db.prepare('SELECT COALESCE(MAX(order_index), -1) as max_index FROM groups WHERE parent_id = ?').get(parentKey) as { max_index: number };
    return row.max_index + 1;
  }

  // 获取默认设置
  private getDefaultSettings() {
    return [
      {
        key: 'security.auto_lock_timeout',
        value: '300',
        type: 'number',
        category: 'security',
        description: '自动锁定时间（秒）'
      },
      {
        key: 'security.password_generator_length',
        value: '16',
        type: 'number',
        category: 'security',
        description: '密码生成器默认长度'
      },
      {
        key: 'security.password_generator_include_symbols',
        value: 'true',
        type: 'boolean',
        category: 'security',
        description: '密码生成器包含特殊字符'
      },
      {
        key: 'security.clipboard_clear_timeout',
        value: '30',
        type: 'number',
        category: 'security',
        description: '剪贴板自动清除时间（秒）'
      },
      {
        key: 'ui.theme',
        value: 'light',
        type: 'string',
        category: 'ui',
        description: '界面主题（light/dark/auto）'
      },
      {
        key: 'ui.language',
        value: 'zh-CN',
        type: 'string',
        category: 'ui',
        description: '界面语言'
      },
      {
        key: 'ui.default_group_color',
        value: 'blue',
        type: 'string',
        category: 'ui',
        description: '默认分组颜色'
      },
      {
        key: 'ui.show_password_strength',
        value: 'true',
        type: 'boolean',
        category: 'ui',
        description: '显示密码强度指示器'
      },
      {
        key: 'backup.auto_export_enabled',
        value: 'false',
        type: 'boolean',
        category: 'backup',
        description: '是否开启自动导出'
      },
      {
        key: 'backup.auto_export_frequency',
        value: 'daily',
        type: 'string',
        category: 'backup',
        description: '自动导出频率'
      },
      {
        key: 'backup.auto_export_time_of_day',
        value: '02:00',
        type: 'string',
        category: 'backup',
        description: '自动导出时间（每日/每周/每月，格式 HH:mm）'
      },
      {
        key: 'backup.auto_export_day_of_week',
        value: '1',
        type: 'number',
        category: 'backup',
        description: '自动导出周几（1=周一 ... 7=周日）'
      },
      {
        key: 'backup.auto_export_day_of_month',
        value: '1',
        type: 'number',
        category: 'backup',
        description: '自动导出日期（1-31）'
      },
      {
        key: 'backup.auto_export_interval_minutes',
        value: '60',
        type: 'number',
        category: 'backup',
        description: '自动导出间隔（分钟，every_minute 模式）'
      },
      {
        key: 'backup.auto_export_directory',
        value: '',
        type: 'string',
        category: 'backup',
        description: '自动导出目录'
      },
      {
        key: 'backup.auto_export_format',
        value: 'json',
        type: 'string',
        category: 'backup',
        description: '自动导出格式'
      },
      {
        key: 'backup.auto_export_password',
        value: '',
        type: 'string',
        category: 'backup',
        description: '自动导出压缩包密码'
      },
      {
        key: 'backup.auto_export_last_time',
        value: '',
        type: 'string',
        category: 'backup',
        description: '上次自动导出时间'
      }
    ];
  }

  // 分组相关方法
  public getGroups(): Group[] {
    return this.groupService.getGroups();
  }

  public getGroupWithChildren(parentId?: number): GroupWithChildren[] {
    return this.groupService.getGroupWithChildren(parentId);
  }

  

  public saveGroup(group: Group): number {
    return this.groupService.saveGroup(group);
  }

  public saveGroupFromImport(group: Group): number {
    return this.groupService.saveGroupFromImport(group);
  }

  public getGroupByName(name: string, parentId?: number): Group | undefined {
    return this.groupService.getGroupByName(name, parentId);
  }

  public deleteGroup(id: number): boolean {
    return this.groupService.deleteGroup(id);
  }

  

  // 数据验证方法
  private validatePassword(password: PasswordItem): void {
    if (!password.title || password.title.trim().length === 0) {
      throw new Error('密码标题不能为空');
    }
    if (password.title.length > 255) {
      throw new Error('密码标题长度不能超过255个字符');
    }
    
    if (!password.username || password.username.trim().length === 0) {
      throw new Error('用户名不能为空');
    }
    if (password.username.length > 255) {
      throw new Error('用户名长度不能超过255个字符');
    }
    
    const hasSinglePassword = !!(password.password && password.password.trim().length > 0);
    if (!hasSinglePassword && !password.id) {
      throw new Error('密码不能为空');
    }
    
    if (password.url && password.url.length > 2048) {
      throw new Error('URL长度不能超过2048个字符');
    }
    
    if (password.notes && password.notes.length > 10000) {
      throw new Error('备注长度不能超过10000个字符');
    }
    
    
    // 取消URL内容格式校验，允许任意字符串（保留长度限制）
  }

  private validateGroup(group: Group): void {
    if (!group.name || group.name.trim().length === 0) {
      throw new Error('分组名称不能为空');
    }
    if (group.name.length > 100) {
      throw new Error('分组名称长度不能超过100个字符');
    }
    
    // 检查分组名称是否包含非法字符
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(group.name)) {
      throw new Error('分组名称不能包含以下字符: < > : " / \\ | ? *');
    }
    
    // 验证颜色值
    const validColors = ['blue', 'green', 'red', 'yellow', 'purple', 'orange', 'pink', 'gray', 'cyan', 'teal'];
    if (group.color && !validColors.includes(group.color)) {
      throw new Error('无效的分组颜色');
    }
  }

  private validateUserSetting(setting: UserSetting): void {
    if (!setting.key || setting.key.trim().length === 0) {
      throw new Error('设置键名不能为空');
    }
    if (setting.key.length > 100) {
      throw new Error('设置键名长度不能超过100个字符');
    }
    
    // 验证键名格式
    const keyPattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
    if (!keyPattern.test(setting.key)) {
      throw new Error('设置键名格式不正确，应使用小写字母、数字、下划线和点');
    }
    
    if (!setting.value && setting.value !== '0') {
      throw new Error('设置值不能为空');
    }
    if (setting.value.length > 10000) {
      throw new Error('设置值长度不能超过10000个字符');
    }
    
    // 验证类型
    const validTypes = ['string', 'number', 'boolean', 'json'];
    if (setting.type && !validTypes.includes(setting.type)) {
      throw new Error('无效的设置类型');
    }
    
    // 验证类别
    const validCategories = ['security', 'ui', 'general', 'backup', 'sync'];
    if (setting.category && !validCategories.includes(setting.category)) {
      throw new Error('无效的设置类别');
    }
  }

  // 检查外键约束
  private validateForeignKey(tableName: string, id: number): void {
    if (!this.db) throw new Error('Database not initialized');
    
    switch (tableName) {
      case 'groups': {
        const groupStmt = this.db.prepare('SELECT id FROM groups WHERE id = ?');
        const group = groupStmt.get(id);
        if (!group) {
          throw new Error('指定的分组不存在');
        }
        break;
      }
        
      case 'passwords': {
        const passwordStmt = this.db.prepare('SELECT id FROM passwords WHERE id = ?');
        const password = passwordStmt.get(id);
        if (!password) {
          throw new Error('指定的密码不存在');
        }
        break;
      }
        
      default:
        throw new Error(`未知的表名: ${tableName}`);
    }
  }

  // 检查循环引用（用于分组树）
  private validateNoCircularReference(groupId: number, parentId?: number): void {
    if (!this.db || !parentId) return;
    
    let currentId: number | undefined = parentId;
    const visited = new Set<number>();
    
    while (currentId) {
      if (currentId === groupId) {
        throw new Error('不能创建循环引用的分组结构');
      }
      
      if (visited.has(currentId)) {
        throw new Error('检测到分组循环引用');
      }
      
      visited.add(currentId);
      
      const stmt = this.db.prepare('SELECT parent_id FROM groups WHERE id = ?');
      const result = stmt.get(currentId) as { parent_id?: number } | undefined;
      currentId = result?.parent_id;
    }
  }

  /**
   * 收集指定分组及其所有子分组的ID（去重、包含自身）
   */
  private collectDescendantIds(nodes: Array<{ id: number; parent_id: number | null }>, rootId: number): number[] {
    const childrenByParent = new Map<number | null, number[]>();
    for (const n of nodes) {
      const key = n.parent_id ?? null;
      const arr = childrenByParent.get(key) || [];
      arr.push(n.id);
      childrenByParent.set(key, arr);
    }

    const result: number[] = [];
    const stack: number[] = [rootId];
    const visited = new Set<number>();

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      result.push(current);
      const children = childrenByParent.get(current) || [];
      for (const child of children) {
        if (!visited.has(child)) stack.push(child);
      }
    }

    return result;
  }

  // 密码相关方法
  public getPasswords(groupId?: number): PasswordItem[] {
    if (groupId == null) return this.passwordService.getPasswords(undefined);
    const groups = this.groupService.getGroups();
    const ids = this.collectDescendantIds(groups.map(g => ({ id: g.id!, parent_id: g.parent_id ?? null })), groupId);
    return this.passwordService.getPasswordsByGroupIds(ids);
  }

  public savePassword(password: PasswordItem): number {
    return this.passwordService.savePasswordFromUI(password);
  }

  public savePasswordFromImport(password: PasswordItem): number {
    return this.passwordService.savePasswordFromImport(password);
  }

  public deletePassword(id: number): boolean {
    return this.passwordService.deletePassword(id);
  }

  // 用户设置相关方法
  public getUserSettings(category?: string): UserSetting[] {
    return this.settingsService.getUserSettings(category);
  }

  public getUserSettingByKey(key: string): UserSetting | null {
    return this.settingsService.getUserSettingByKey(key);
  }

  public saveUserSetting(setting: Omit<UserSetting, 'id' | 'created_at' | 'updated_at'>): boolean {
    return this.settingsService.saveUserSetting(setting);
  }

  public saveUserSettingFromImport(setting: UserSetting): boolean {
    return this.settingsService.importSettings([setting]) > 0;
  }

  public updateUserSetting(key: string, value: string): boolean {
    return this.settingsService.updateUserSetting(key, value);
  }

  public deleteUserSetting(key: string): boolean {
    return this.settingsService.deleteUserSetting(key);
  }

  public getUserSettingsCategories(): UserSettingsCategory[] {
    return this.settingsService.getUserSettingsCategories();
  }

  // 类别描述由 SettingsService 管理

  public getTypedUserSetting<T>(key: string, defaultValue: T): T {
    return this.settingsService.getTypedUserSetting<T>(key, defaultValue);
  }

  // 密码历史记录相关方法
  public getPasswordHistory(passwordId: number): PasswordHistory[] {
    return this.passwordService.getPasswordHistory(passwordId);
  }

  private savePasswordHistory(passwordId: number, oldPassword: string, newPassword: string, reason?: string): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT INTO password_history (password_id, old_password, new_password, changed_at, changed_reason) 
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(passwordId, oldPassword, newPassword, new Date().toISOString(), reason || null);
  }

  // 获取需要更新密码的列表（6个月未更新）
  public getPasswordsNeedingUpdate(): PasswordItem[] {
    return this.passwordService.getPasswordsNeedingUpdate();
  }

  // 搜索密码（使用FTS5全文搜索）
  public searchPasswords(keyword: string): PasswordItem[] {
    return this.passwordService.searchPasswords(keyword);
  }

  // 高级搜索（支持多字段和布尔查询）
  public advancedSearch(options: {
    keyword?: string;
    title?: string;
    username?: string;
    url?: string;
    notes?: string;
    groupId?: number;
    dateFrom?: string;
    dateTo?: string;
  }): PasswordItem[] {
    return this.passwordService.advancedSearch(options);
  }

  // 根据ID获取单个密码
  public getPasswordById(id: number): PasswordItem | null {
    return this.passwordService.getPasswordById(id);
  }

  // 获取密码的多账号信息
  

  // 更新密码（记录历史）
  public updatePassword(id: number, newPassword: string, reason?: string): void {
    this.passwordService.updatePassword(id, newPassword, reason);
  }

  // 根据ID获取分组
  public getGroupById(id: number): Group | undefined {
    return this.groupService.getGroupById(id);
  }

  // 重置设置为默认值
  public resetSettingToDefault(key: string): boolean {
    if (!this.db) throw new Error('Database not initialized');
    
    const defaultSettings = this.getDefaultSettings();
    const defaultSetting = defaultSettings.find(setting => setting.key === key);
    
    if (!defaultSetting) return false;
    
    return this.updateUserSetting(key, defaultSetting.value);
  }

  // 重置所有设置为默认值
  public resetAllSettingsToDefault(): number {
    if (!this.db) throw new Error('Database not initialized');
    
    const defaultSettings = this.getDefaultSettings();
    let resetCount = 0;
    
    for (const setting of defaultSettings) {
      if (this.updateUserSetting(setting.key, setting.value)) {
        resetCount++;
      }
    }
    
    return resetCount;
  }

  // 导入导出功能
  public exportData(options: {
    format: 'json' | 'encrypted_zip';
    includeHistory?: boolean;
    includeGroups?: boolean;
    includeSettings?: boolean;
    archivePassword?: string;
  }): Promise<Uint8Array> {
    return this.backupService.exportData(options);
  }

  // 保留CSV工具但不对外导出
  


  public importData(data: Uint8Array, options: {
    format: 'json';
    mergeStrategy: 'replace' | 'merge' | 'skip';
    validateIntegrity: boolean;
    dryRun: boolean;
  }): Promise<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    warnings: string[];
  }> {
    return this.backupService.importData(data, options);
  }



  // 导入设置
  public importSettings(settings: UserSetting[]): number {
    return this.settingsService.importSettings(settings);
  }

  // 导出设置
  public exportSettings(categories?: string[]): UserSetting[] {
    return this.settingsService.exportSettings(categories);
  }

  // 添加历史记录
  public addPasswordHistory(history: PasswordHistory): number {
    return this.passwordService.addPasswordHistory(history);
  }

  // 根据ID获取历史记录
  public getHistoryById(id: number): PasswordHistory | undefined {
    return this.passwordService.getHistoryById(id);
  }

  // 删除历史记录
  public deleteHistory(id: number): void {
    return this.passwordService.deleteHistory(id);
  }

  // 清理旧历史记录
  public cleanOldHistory(daysToKeep: number = 365): number {
    return this.passwordService.cleanOldHistory(daysToKeep);
  }

  public getNoteGroups(): SecureRecordGroup[] {
    return this.noteService.getNoteGroups();
  }

  public getNoteGroupTree(parentId?: number) {
    return this.noteService.getNoteGroupTree(parentId);
  }

  public saveNoteGroup(group: SecureRecordGroup): number {
    return this.noteService.saveNoteGroup(group);
  }

  public saveNoteGroupFromImport(group: SecureRecordGroup): number {
    return this.noteService.saveNoteGroupFromImport(group);
  }

  public deleteNoteGroup(id: number): boolean {
    return this.noteService.deleteNoteGroup(id);
  }

  public getNotes(groupId?: number): SecureRecord[] {
    if (groupId == null) return this.noteService.getNotes(undefined);
    const groups = this.noteService.getNoteGroups();
    const ids = this.collectDescendantIds(groups.map(g => ({ id: g.id!, parent_id: g.parent_id ?? null })), groupId);
    return this.noteService.getNotesByGroupIds(ids);
  }

  public getNoteById(id: number): SecureRecord | null {
    return this.noteService.getNoteById(id);
  }

  public saveNote(note: SecureRecord): number {
    return this.noteService.saveNote(note);
  }

  public saveNoteFromImport(note: SecureRecord): number {
    return this.noteService.saveNoteFromImport(note);
  }

  public deleteNote(id: number): boolean {
    return this.noteService.deleteNote(id);
  }

  public searchNotesByTitle(keyword: string): SecureRecord[] {
    return this.noteService.searchNotesByTitle(keyword);
  }

  // 数据完整性检查方法
  public checkDataIntegrity(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    return this.integrityService.check();
  }

  private checkForeignKeyIntegrity(errors: string[]): void {
    // 检查密码的分组ID是否存在
    const invalidGroupPasswords = this.db!.prepare(`
      SELECT p.id, p.title, p.group_id 
      FROM passwords p 
      LEFT JOIN groups g ON p.group_id = g.id 
      WHERE p.group_id IS NOT NULL AND g.id IS NULL
    `).all();

    for (const row of invalidGroupPasswords as any[]) {
      errors.push(`密码 "${row.title}" (ID: ${row.id}) 引用了不存在的分组 (ID: ${row.group_id})`);
    }

    // 检查密码历史的密码ID是否存在
    const invalidHistory = this.db!.prepare(`
      SELECT ph.id, ph.password_id 
      FROM password_history ph 
      LEFT JOIN passwords p ON ph.password_id = p.id 
      WHERE p.id IS NULL
    `).all();

    for (const row of invalidHistory as any[]) {
      errors.push(`密码历史记录 (ID: ${row.id}) 引用了不存在的密码 (ID: ${row.password_id})`);
    }
  }

  private checkUniquenessConstraints(errors: string[]): void {
    // 检查用户设置键的唯一性
    const duplicateSettings = this.db!.prepare(`
      SELECT key, COUNT(*) as count 
      FROM user_settings 
      GROUP BY key 
      HAVING COUNT(*) > 1
    `).all();

    for (const row of duplicateSettings as any[]) {
      errors.push(`用户设置键 "${row.key}" 重复了 ${row.count} 次`);
    }

    // 检查分组名称的唯一性（在同一父分组下）
    const duplicateGroups = this.db!.prepare(`
      SELECT name, parent_id, COUNT(*) as count 
      FROM groups 
      GROUP BY name, parent_id 
      HAVING COUNT(*) > 1
    `).all();

    for (const row of duplicateGroups as any[]) {
      const parent = row.parent_id ? `父分组ID: ${row.parent_id}` : '根分组';
      errors.push(`分组名称 "${row.name}" 在 ${parent} 下重复了 ${row.count} 次`);
    }
  }

  private checkDataFormat(errors: string[], warnings: string[]): void {
    // 检查时间戳格式
    const invalidTimestampsRows = this.db!.prepare(`
      SELECT 'passwords' as table_name, id, created_at, updated_at FROM passwords 
      WHERE created_at NOT LIKE '%-%-%T%:%:%.%Z' OR updated_at NOT LIKE '%-%-%T%:%:%.%Z'
      UNION ALL
      SELECT 'groups' as table_name, id, created_at, updated_at FROM groups 
      WHERE created_at NOT LIKE '%-%-%T%:%:%.%Z' OR updated_at NOT LIKE '%-%-%T%:%:%.%Z'
      UNION ALL
      SELECT 'password_history' as table_name, id, changed_at as created_at, changed_at as updated_at FROM password_history 
      WHERE changed_at NOT LIKE '%-%-%T%:%:%.%Z'
    `).all() as any[];

    for (const row of invalidTimestampsRows) {
      errors.push(`${row.table_name} 表中的记录 (ID: ${row.id}) 时间戳格式不正确`);
    }

    // 检查必填字段
    const emptyRequiredFields = this.db!.prepare(`
      SELECT 'passwords' as table_name, id, 'title' as field_name FROM passwords WHERE title IS NULL OR title = ''
      UNION ALL
      SELECT 'passwords' as table_name, id, 'username' as field_name FROM passwords WHERE username IS NULL OR username = ''
      UNION ALL
      SELECT 'passwords' as table_name, id, 'password' as field_name FROM passwords WHERE password IS NULL OR password = ''
      UNION ALL
      SELECT 'groups' as table_name, id, 'name' as field_name FROM groups WHERE name IS NULL OR name = ''
      UNION ALL
      SELECT 'user_settings' as table_name, id, 'key' as field_name FROM user_settings WHERE key IS NULL OR key = ''
      UNION ALL
      SELECT 'user_settings' as table_name, id, 'value' as field_name FROM user_settings WHERE value IS NULL OR value = ''
    `).all();

    const emptyRows = emptyRequiredFields as any[];
    for (const row of emptyRows) {
      errors.push(`${row.table_name} 表中的记录 (ID: ${row.id}) 必填字段 ${row.field_name} 为空`);
    }

    // 检查过长的字段
    const longFieldsRows = this.db!.prepare(`
      SELECT 'passwords' as table_name, id, 'title' as field_name, LENGTH(title) as length FROM passwords WHERE LENGTH(title) > 255
      UNION ALL
      SELECT 'passwords' as table_name, id, 'username' as field_name, LENGTH(username) as length FROM passwords WHERE LENGTH(username) > 255
      UNION ALL
      SELECT 'passwords' as table_name, id, 'url' as field_name, LENGTH(url) as length FROM passwords WHERE LENGTH(url) > 2048
      UNION ALL
      SELECT 'groups' as table_name, id, 'name' as field_name, LENGTH(name) as length FROM groups WHERE LENGTH(name) > 100
    `).all() as any[];

    for (const row of longFieldsRows) {
      warnings.push(`${row.table_name} 表中的记录 (ID: ${row.id}) 字段 ${row.field_name} 长度 ${row.length} 可能过长`);
    }
  }

  private checkCircularReferences(errors: string[]): void {
    // 检查分组循环引用
    const groups = this.db!.prepare('SELECT id, name, parent_id FROM groups').all() as Array<{ id: number; name: string; parent_id?: number }>;
    const visited = new Set<number>();
    const recursionStack = new Set<number>();

    const hasCycle = (groupId: number): boolean => {
      if (recursionStack.has(groupId)) {
        return true; // 发现循环
      }
      if (visited.has(groupId)) {
        return false; // 已检查过
      }

      visited.add(groupId);
      recursionStack.add(groupId);

      const group = groups.find((g: any) => g.id === groupId);
      if (group && (group as any).parent_id) {
        if (hasCycle((group as any).parent_id)) {
          return true;
        }
      }

      recursionStack.delete(groupId);
      return false;
    };

    for (const group of groups) {
      if (!visited.has(group.id) && hasCycle(group.id)) {
        errors.push(`检测到分组循环引用，涉及分组ID: ${group.id} (${group.name})`);
      }
    }
  }

  private checkOrphanedData(warnings: string[]): void {
    // 检查没有密码的空分组
    const emptyGroups = this.db!.prepare(`
      SELECT g.id, g.name 
      FROM groups g 
      LEFT JOIN passwords p ON g.id = p.group_id 
      WHERE p.id IS NULL
    `).all() as Array<{ id: number; name: string }>;

    for (const group of emptyGroups) {
      warnings.push(`分组 "${group.name}" (ID: ${group.id}) 没有包含任何密码`);
    }

    // 检查过期的密码历史记录
    const oldHistory = this.db!.prepare(`
      SELECT COUNT(*) as count 
      FROM password_history 
      WHERE changed_at < datetime('now', '-2 years')
    `).get() as { count: number };

    if (oldHistory.count > 0) {
      warnings.push(`发现 ${oldHistory.count} 条超过2年的密码历史记录，建议清理`);
    }
  }

  // 修复数据完整性问题
  public repairDataIntegrity(): {
    repaired: string[];
    failed: string[];
  } {
    return this.integrityService.repair();
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default DatabaseService;
