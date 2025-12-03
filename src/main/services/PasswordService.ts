import type Database from 'better-sqlite3';

export interface PasswordItem {
  id?: number;
  title: string;
  username: string;
  password?: string | null;
  url?: string | null;
  notes?: string | null;
  multi_accounts?: string | null;
  group_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface PasswordHistory {
  id?: number;
  password_id: number;
  old_password: string;
  new_password: string;
  changed_at: string;
  changed_reason?: string;
}

export interface CryptoAdapter {
  encrypt(text: string): string;
  decrypt(text: string): string;
}

/**
 * 密码模块服务，负责密码的增删改查、全文搜索与历史记录管理
 */
export class PasswordService {
  private db: Database.Database;
  private crypto: CryptoAdapter;

  constructor(db: Database.Database, crypto: CryptoAdapter) {
    this.db = db;
    this.crypto = crypto;
    this.ensurePasswordSchema();
  }

  /** 获取密码列表（可选按分组过滤），自动解密敏感字段 */
  public getPasswords(groupId?: number): PasswordItem[] {
    let stmt;
    if (groupId) {
      stmt = this.db.prepare('SELECT * FROM passwords WHERE group_id = ? ORDER BY created_at DESC');
      const rows = stmt.all(groupId) as PasswordItem[];
      return rows.map(p => ({
        ...p,
        password: p.password ? this.crypto.decrypt(p.password) : '',
        multi_accounts: p.multi_accounts ? this.crypto.decrypt(p.multi_accounts) : undefined
      }));
    } else {
      stmt = this.db.prepare('SELECT * FROM passwords ORDER BY created_at DESC');
      const rows = stmt.all() as PasswordItem[];
      return rows.map(p => ({
        ...p,
        password: p.password ? this.crypto.decrypt(p.password) : '',
        multi_accounts: p.multi_accounts ? this.crypto.decrypt(p.multi_accounts) : undefined
      }));
    }
  }

  public savePasswordFromUI(password: PasswordItem): number {
    this.validatePassword(password);

    if (password.group_id) {
      const row = this.db.prepare('SELECT id FROM groups WHERE id = ?').get(password.group_id);
      if (!row) throw new Error('指定的分组不存在');
    }

    const now = new Date().toISOString();
    const hasSinglePassword = !!(password.password && password.password.trim() !== '');
    const encryptedPassword = hasSinglePassword ? this.crypto.encrypt(password.password!) : null;
    const encryptedMultiAccounts = password.multi_accounts ? this.crypto.encrypt(password.multi_accounts) : null;

    if (password.id) {
      const existing = this.db.prepare('SELECT id, password, multi_accounts FROM passwords WHERE id = ?').get(password.id) as { id: number; password: string; multi_accounts?: string } | undefined;
      if (!existing) throw new Error('指定的密码不存在');
      const stmt = this.db.prepare(
        `UPDATE passwords SET title = ?, username = ?, password = ?, url = ?, notes = ?, multi_accounts = ?, group_id = ?, updated_at = ? WHERE id = ?`
      );
      stmt.run(
        password.title,
        password.username,
        encryptedPassword ?? existing.password,
        password.url || null,
        password.notes || null,
        encryptedMultiAccounts ?? (existing.multi_accounts ?? null),
        password.group_id || null,
        now,
        password.id
      );
      if (encryptedPassword && existing.password !== encryptedPassword) {
        this.savePasswordHistory(password.id, existing.password, encryptedPassword, undefined);
      }
      return password.id;
    } else {
      const stmt = this.db.prepare(
        `INSERT INTO passwords (title, username, password, url, notes, multi_accounts, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const result = stmt.run(
        password.title,
        password.username,
        encryptedPassword,
        password.url || null,
        password.notes || null,
        encryptedMultiAccounts,
        password.group_id || null,
        now,
        now
      );
      return result.lastInsertRowid as number;
    }
  }

  public savePasswordFromImport(password: PasswordItem): number {
    this.validatePassword(password);

    if (password.group_id) {
      const row = this.db.prepare('SELECT id FROM groups WHERE id = ?').get(password.group_id);
      if (!row) throw new Error('指定的分组不存在');
    }

    const now = new Date().toISOString();

    if (password.id) {
      const existing = this.db.prepare('SELECT id FROM passwords WHERE id = ?').get(password.id) as { id: number } | undefined;
      if (existing) {
        const stmt = this.db.prepare(
          `UPDATE passwords SET title = ?, username = ?, password = ?, url = ?, notes = ?, multi_accounts = ?, group_id = ?, updated_at = ? WHERE id = ?`
        );
        stmt.run(
          password.title,
          password.username,
          password.password ?? null,
          password.url || null,
          password.notes || null,
          password.multi_accounts ?? null,
          password.group_id || null,
          now,
          password.id
        );
        return password.id;
      } else {
        const stmt = this.db.prepare(
          `INSERT INTO passwords (id, title, username, password, url, notes, multi_accounts, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const result = stmt.run(
          password.id,
          password.title,
          password.username,
          password.password ?? null,
          password.url || null,
          password.notes || null,
          password.multi_accounts ?? null,
          password.group_id || null,
          now,
          now
        );
        return result.lastInsertRowid as number;
      }
    } else {
      const stmt = this.db.prepare(
        `INSERT INTO passwords (title, username, password, url, notes, multi_accounts, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const result = stmt.run(
        password.title,
        password.username,
        password.password ?? null,
        password.url || null,
        password.notes || null,
        password.multi_accounts ?? null,
        password.group_id || null,
        now,
        now
      );
      return result.lastInsertRowid as number;
    }
  }

  /** 删除指定ID的密码 */
  public deletePassword(id: number): boolean {
    const res = this.db.prepare('DELETE FROM passwords WHERE id = ?').run(id);
    return res.changes > 0;
  }

  /** 获取指定密码的历史记录（解密旧/新密码） */
  public getPasswordHistory(passwordId: number): PasswordHistory[] {
    const stmt = this.db.prepare('SELECT * FROM password_history WHERE password_id = ? ORDER BY changed_at DESC');
    const rows = stmt.all(passwordId) as PasswordHistory[];
    return rows.map(h => ({
      ...h,
      old_password: this.crypto.decrypt(h.old_password),
      new_password: this.crypto.decrypt(h.new_password)
    }));
  }

  /** 添加一条密码历史记录（自动加密） */
  public addPasswordHistory(history: PasswordHistory): number {
    const stmt = this.db.prepare(
      `INSERT INTO password_history (password_id, old_password, new_password, changed_at, changed_reason) VALUES (?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      history.password_id,
      this.crypto.encrypt(history.old_password),
      this.crypto.encrypt(history.new_password),
      history.changed_at || new Date().toISOString(),
      history.changed_reason || null
    );
    return result.lastInsertRowid as number;
  }

  /** 根据历史记录ID获取详情（解密） */
  public getHistoryById(id: number): PasswordHistory | undefined {
    const row = this.db.prepare('SELECT * FROM password_history WHERE id = ?').get(id) as PasswordHistory | undefined;
    if (!row) return undefined;
    return {
      ...row,
      old_password: this.crypto.decrypt(row.old_password),
      new_password: this.crypto.decrypt(row.new_password)
    };
  }

  /** 删除历史记录 */
  public deleteHistory(id: number): void {
    this.db.prepare('DELETE FROM password_history WHERE id = ?').run(id);
  }

  /** 清理指定天数之前的历史记录，返回清理数量 */
  public cleanOldHistory(daysToKeep: number = 365): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const res = this.db.prepare('DELETE FROM password_history WHERE changed_at < ?').run(cutoff.toISOString());
    return res.changes;
  }

  /** 获取超过6个月未更新的密码列表（解密） */
  public getPasswordsNeedingUpdate(): PasswordItem[] {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    const rows = this.db.prepare('SELECT * FROM passwords WHERE updated_at < ? ORDER BY updated_at ASC').all(d.toISOString()) as PasswordItem[];
    return rows.map(p => ({
      ...p,
      password: p.password ? this.crypto.decrypt(p.password) : '',
      multi_accounts: p.multi_accounts ? this.crypto.decrypt(p.multi_accounts) : undefined
    }));
  }

  /** 使用 FTS5 进行全文搜索（按更新时间排序） */
  public searchPasswords(keyword: string): PasswordItem[] {
    const stmt = this.db.prepare(
      `SELECT p.* FROM passwords p JOIN passwords_fts fts ON p.id = fts.rowid WHERE passwords_fts MATCH ? ORDER BY p.updated_at DESC`
    );
    const q = keyword.includes(' ') ? `"${keyword}"` : keyword;
    const rows = stmt.all(q) as PasswordItem[];
    return rows.map(p => ({
      ...p,
      password: p.password ? this.crypto.decrypt(p.password) : '',
      multi_accounts: p.multi_accounts ? this.crypto.decrypt(p.multi_accounts) : undefined
    }));
  }

  /** 高级搜索：支持字段过滤、日期范围与关键字（FTS） */
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
    let query = 'SELECT * FROM passwords WHERE 1=1';
    const params: any[] = [];
    if (options.keyword && options.keyword.trim()) {
      query += ` AND id IN (SELECT rowid FROM passwords_fts WHERE passwords_fts MATCH ?)`;
      params.push(options.keyword.includes(' ') ? `"${options.keyword}"` : options.keyword);
    }
    if (options.title) { query += ' AND title LIKE ?'; params.push(`%${options.title}%`); }
    if (options.username) { query += ' AND username LIKE ?'; params.push(`%${options.username}%`); }
    if (options.url) { query += ' AND url LIKE ?'; params.push(`%${options.url}%`); }
    if (options.notes) { query += ' AND notes LIKE ?'; params.push(`%${options.notes}%`); }
    if (options.groupId) { query += ' AND group_id = ?'; params.push(options.groupId); }
    if (options.dateFrom) { query += ' AND updated_at >= ?'; params.push(options.dateFrom); }
    if (options.dateTo) { query += ' AND updated_at <= ?'; params.push(options.dateTo); }
    query += ' ORDER BY updated_at DESC';
    const rows = this.db.prepare(query).all(...params) as PasswordItem[];
    return rows.map(p => ({
      ...p,
      password: p.password ? this.crypto.decrypt(p.password) : '',
      multi_accounts: p.multi_accounts ? this.crypto.decrypt(p.multi_accounts) : undefined
    }));
  }

  /** 根据ID获取单个密码（解密） */
  public getPasswordById(id: number): PasswordItem | null {
    const row = this.db.prepare('SELECT * FROM passwords WHERE id = ?').get(id) as PasswordItem | undefined;
    if (!row) return null;
    return {
      ...row,
      password: row.password ? this.crypto.decrypt(row.password) : '',
      multi_accounts: row.multi_accounts ? this.crypto.decrypt(row.multi_accounts) : undefined
    };
  }

  /** 获取/设置多账号信息（文本，解密/加密） */
  public getPasswordMultiAccounts(id: number): string | null {
    const res = this.db.prepare('SELECT multi_accounts FROM passwords WHERE id = ?').get(id) as { multi_accounts: string } | undefined;
    if (!res || !res.multi_accounts) return null;
    return this.crypto.decrypt(res.multi_accounts);
  }

  /** 设置多账号信息（加密存储并更新时间） */
  public setPasswordMultiAccounts(id: number, accounts: string): void {
    const enc = this.crypto.encrypt(accounts);
    const now = new Date().toISOString();
    this.db.prepare('UPDATE passwords SET multi_accounts = ?, updated_at = ? WHERE id = ?').run(enc, now, id);
  }

  /** 更新单个密码并记录历史（加密新密码） */
  public updatePassword(id: number, newPassword: string, reason?: string): void {
    const oldRow = this.db.prepare('SELECT password FROM passwords WHERE id = ?').get(id) as { password: string } | undefined;
    if (!oldRow) throw new Error('Password not found');
    const enc = this.crypto.encrypt(newPassword);
    const now = new Date().toISOString();
    this.db.prepare('UPDATE passwords SET password = ?, updated_at = ? WHERE id = ?').run(enc, now, id);
    this.savePasswordHistory(id, oldRow.password, enc, reason);
  }

  /** 内部：保存历史（保持加密态） */
  private savePasswordHistory(passwordId: number, oldPasswordEnc: string, newPasswordEnc: string, reason?: string): void {
    this.db.prepare(
      `INSERT INTO password_history (password_id, old_password, new_password, changed_at, changed_reason) VALUES (?, ?, ?, ?, ?)`
    ).run(passwordId, oldPasswordEnc, newPasswordEnc, new Date().toISOString(), reason || null);
  }

  /** 校验密码条目字段合法性（标题、用户名、URL、文本长度等） */
  public validatePassword(password: PasswordItem): void {
    if (!password.title || password.title.trim().length === 0) throw new Error('密码标题不能为空');
    if (password.title.length > 255) throw new Error('密码标题长度不能超过255个字符');
    if (!password.username || password.username.trim().length === 0) throw new Error('用户名不能为空');
    if (password.username.length > 255) throw new Error('用户名长度不能超过255个字符');
    const hasSingle = !!(password.password && password.password.trim().length > 0);
    const hasMulti = !!(password.multi_accounts && String(password.multi_accounts).trim().length > 0);
    if (!hasSingle && !hasMulti && !password.id) throw new Error('密码不能为空');
    if (password.url && password.url.length > 2048) throw new Error('URL长度不能超过2048个字符');
    if (password.notes && password.notes.length > 10000) throw new Error('备注长度不能超过10000个字符');
    if (password.multi_accounts && String(password.multi_accounts).length > 50000) throw new Error('多账号信息长度不能超过50000个字符');

  }

  /** 确保密码表允许 password 为 NULL，并重建 FTS 触发器 */
  private ensurePasswordSchema(): void {
    const cols = this.db.prepare('PRAGMA table_info(passwords)').all() as Array<{ name: string; notnull: number }>;
    const pwdCol = cols.find(c => c.name === 'password');
    if (pwdCol && pwdCol.notnull === 1) {
      this.db.exec('BEGIN');
      try {
        this.db.exec(`
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
        this.db.exec(`
          INSERT INTO passwords_migrated (id, title, username, password, url, notes, multi_accounts, group_id, created_at, updated_at)
          SELECT id, title, username, password, url, notes, multi_accounts, group_id, created_at, updated_at FROM passwords
        `);
        this.db.exec('DROP TABLE passwords');
        this.db.exec('ALTER TABLE passwords_migrated RENAME TO passwords');
        this.db.exec(`DROP TRIGGER IF EXISTS passwords_fts_insert; DROP TRIGGER IF EXISTS passwords_fts_update; DROP TRIGGER IF EXISTS passwords_fts_delete;`);
        this.db.exec(`
          CREATE TRIGGER IF NOT EXISTS passwords_fts_insert AFTER INSERT ON passwords BEGIN
            INSERT INTO passwords_fts(rowid, title, username, url, notes)
            VALUES (new.id, new.title, new.username, new.url, new.notes);
          END;
        `);
        this.db.exec(`
          CREATE TRIGGER IF NOT EXISTS passwords_fts_update AFTER UPDATE ON passwords BEGIN
            UPDATE passwords_fts SET title = new.title, username = new.username, url = new.url, notes = new.notes WHERE rowid = new.id;
          END;
        `);
        this.db.exec(`
          CREATE TRIGGER IF NOT EXISTS passwords_fts_delete AFTER DELETE ON passwords BEGIN
            DELETE FROM passwords_fts WHERE rowid = old.id;
          END;
        `);
        this.db.exec('COMMIT');
      } catch (e) {
        this.db.exec('ROLLBACK');
      }
    }
  }
}

export default PasswordService;
