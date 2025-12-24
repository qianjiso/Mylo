import type Database from 'better-sqlite3';
import { PasswordItem, PasswordHistory } from '../../shared/types';

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
  private isEnc(text: string | null | undefined): boolean {
    if (!text) return false;
    const parts = String(text).split(':');
    if (parts.length !== 2) return false;
    return /^[0-9a-f]+$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[1]);
  }
  private maskUsername(s: string): string {
    const str = s || '';
    if (!str) return '';
    if (/^1[3-9]\d{9}$/.test(str)) {
      return str.slice(0, 3) + '***' + str.slice(-3);
    }
    const emailIdx = str.indexOf('@');
    if (emailIdx > 0) {
      const local = str.slice(0, emailIdx);
      const domain = str.slice(emailIdx + 1);
      const keep = Math.min(3, Math.max(1, local.length > 6 ? 3 : 1));
      const maskedLocal = local.length <= keep ? local : local.slice(0, keep) + '***';
      return maskedLocal + '@' + domain;
    }
    if (/^\d{15}$/.test(str) || /^\d{17}[\dXx]$/.test(str)) {
      const head = str.slice(0, 4);
      const tail = str.slice(-4);
      return head + '**********' + tail;
    }
    if (str.length <= 6) {
      const head = str.slice(0, 1);
      const tail = str.slice(-1);
      return head + '***' + tail;
    }
    return str.slice(0, 3) + '***' + str.slice(-3);
  }

  constructor(db: Database.Database, crypto: CryptoAdapter) {
    this.db = db;
    this.crypto = crypto;
    this.ensurePasswordSchema();
  }

  /** 获取密码列表（可选按分组过滤），自动解密敏感字段 */
  public getPasswords(groupId?: number): PasswordItem[] {
    const stmt = groupId
      ? this.db.prepare('SELECT * FROM passwords WHERE group_id = ? ORDER BY created_at DESC')
      : this.db.prepare('SELECT * FROM passwords ORDER BY created_at DESC');
    const rows = (groupId ? stmt.all(groupId) : stmt.all()) as PasswordItem[];
    return rows.map(p => {
      const unameRaw = p.username;
      const unamePlain = this.isEnc(unameRaw) ? this.crypto.decrypt(unameRaw as any) : (unameRaw || '');
      return {
        ...p,
        username: this.maskUsername(unamePlain),
        password: p.password ? this.crypto.decrypt(p.password) : ''
      } as any;
    });
  }

  /** 导出专用：返回明文用户名和明文密码 */
  public getPasswordsForExport(): PasswordItem[] {
    const rows = this.db.prepare('SELECT * FROM passwords ORDER BY created_at DESC').all() as PasswordItem[];
    return rows.map(p => {
      const unameRaw = p.username;
      const unamePlain = this.isEnc(unameRaw) ? this.crypto.decrypt(unameRaw as any) : (unameRaw || '');
      return {
        ...p,
        username: unamePlain,
        password: p.password ? this.crypto.decrypt(p.password) : ''
      } as any;
    });
  }

  /** 按多个分组ID获取密码列表（包含子分组），自动解密 */
  public getPasswordsByGroupIds(groupIds: number[]): PasswordItem[] {
    if (!groupIds || groupIds.length === 0) return this.getPasswords(undefined);
    const placeholders = groupIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM passwords WHERE group_id IN (${placeholders}) ORDER BY created_at DESC`);
    const rows = stmt.all(...groupIds) as PasswordItem[];
    return rows.map(p => {
      const unameRaw = p.username;
      const unamePlain = this.isEnc(unameRaw) ? this.crypto.decrypt(unameRaw as any) : (unameRaw || '');
      return {
        ...p,
        username: this.maskUsername(unamePlain),
        password: p.password ? this.crypto.decrypt(p.password) : ''
      } as any;
    });
  }

  public savePasswordFromUI(password: PasswordItem): number {
    this.validatePassword(password);

    if (password.group_id) {
      const row = this.db.prepare('SELECT id FROM groups WHERE id = ?').get(password.group_id);
      if (!row) throw new Error('指定的分组不存在');
    }

    const now = new Date().toISOString();
    const hasInput = !!(password.password && password.password.trim() !== '');

    if (password.id) {
      const existing = this.db.prepare('SELECT id, password FROM passwords WHERE id = ?').get(password.id) as { id: number; password: string | null } | undefined;
      if (!existing) throw new Error('指定的密码不存在');
      let encryptedPassword: string | null = null;
      let changed = false;
      if (hasInput) {
        const existingPlain = existing.password ? this.crypto.decrypt(existing.password) : '';
        changed = existingPlain !== (password.password || '');
        if (changed) {
          encryptedPassword = this.crypto.encrypt(password.password!);
        }
      }
      const stmt = this.db.prepare(
        `UPDATE passwords SET title = ?, username = ?, password = ?, url = ?, notes = ?, group_id = ?, updated_at = ? WHERE id = ?`
      );
      stmt.run(
        password.title,
        this.crypto.encrypt(password.username),
        encryptedPassword ?? existing.password,
        password.url || null,
        password.notes || null,
        password.group_id || null,
        now,
        password.id
      );
      if (changed && encryptedPassword) {
        this.savePasswordHistory(password.id, existing.password!, encryptedPassword, undefined);
      }
      return password.id;
    } else {
      const stmt = this.db.prepare(
        `INSERT INTO passwords (title, username, password, url, notes, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const result = stmt.run(
        password.title,
        this.crypto.encrypt(password.username),
        hasInput ? this.crypto.encrypt(password.password!) : null,
        password.url || null,
        password.notes || null,
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
          `UPDATE passwords SET title = ?, username = ?, password = ?, url = ?, notes = ?, group_id = ?, updated_at = ? WHERE id = ?`
        );
        stmt.run(
          password.title,
          this.isEnc(password.username) ? password.username : this.crypto.encrypt(password.username),
          password.password ?? null,
          password.url || null,
          password.notes || null,
          password.group_id || null,
          now,
          password.id
        );
        return password.id;
      } else {
        const stmt = this.db.prepare(
          `INSERT INTO passwords (id, title, username, password, url, notes, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const result = stmt.run(
          password.id,
          password.title,
          this.isEnc(password.username) ? password.username : this.crypto.encrypt(password.username),
          password.password ?? null,
          password.url || null,
          password.notes || null,
          password.group_id || null,
          now,
          now
        );
        return result.lastInsertRowid as number;
      }
    } else {
      const stmt = this.db.prepare(
        `INSERT INTO passwords (title, username, password, url, notes, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const result = stmt.run(
        password.title,
        this.isEnc(password.username) ? password.username : this.crypto.encrypt(password.username),
        password.password ?? null,
        password.url || null,
        password.notes || null,
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
    return rows.map(p => {
      const unameRaw = p.username;
      const unamePlain = this.isEnc(unameRaw) ? this.crypto.decrypt(unameRaw as any) : (unameRaw || '');
      return {
        ...p,
        username: this.maskUsername(unamePlain),
        password: p.password ? this.crypto.decrypt(p.password) : ''
      } as any;
    });
  }

  /** 使用 FTS5 进行全文搜索（按更新时间排序） */
  public searchPasswords(keyword: string): PasswordItem[] {
    const trimmed = keyword.trim();
    if (!trimmed) return [];
    const useLike = /[\u3400-\u9fff]/.test(trimmed);
    const ftsRows = useLike
      ? (this.db.prepare(
        'SELECT * FROM passwords WHERE title LIKE ? OR url LIKE ? OR notes LIKE ? ORDER BY updated_at DESC'
      ).all(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`) as PasswordItem[])
      : (this.db.prepare(
        `SELECT p.* FROM passwords p JOIN passwords_fts fts ON p.id = fts.rowid WHERE passwords_fts MATCH ? ORDER BY p.updated_at DESC`
      ).all(trimmed.includes(' ') ? `"${trimmed}"` : trimmed) as PasswordItem[]);
    const allRows = this.db.prepare('SELECT * FROM passwords').all() as PasswordItem[];
    const unameMatches = allRows.filter(p => {
      const unameRaw = p.username;
      const unamePlain = this.isEnc(unameRaw) ? this.crypto.decrypt(unameRaw as any) : (unameRaw || '');
      return unamePlain && unamePlain.toLowerCase().includes(trimmed.toLowerCase());
    });
    const mergedMap = new Map<number, PasswordItem>();
    for (const r of [...ftsRows, ...unameMatches]) {
      if (r.id != null) mergedMap.set(r.id!, r);
    }
    const out = Array.from(mergedMap.values()).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    return out.map(p => {
      const unameRaw = p.username;
      const unamePlain = this.isEnc(unameRaw) ? this.crypto.decrypt(unameRaw as any) : (unameRaw || '');
      return {
        ...p,
        username: this.maskUsername(unamePlain),
        password: p.password ? this.crypto.decrypt(p.password) : ''
      } as any;
    });
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
    const keyword = options.keyword?.trim();
    if (keyword) {
      const useLike = /[\u3400-\u9fff]/.test(keyword);
      if (useLike) {
        query += ' AND (title LIKE ? OR url LIKE ? OR notes LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      } else {
        query += ' AND id IN (SELECT rowid FROM passwords_fts WHERE passwords_fts MATCH ?)';
        params.push(keyword.includes(' ') ? `"${keyword}"` : keyword);
      }
    }
    if (options.title) { query += ' AND title LIKE ?'; params.push(`%${options.title}%`); }
    // username 采用应用层匹配，避免明文进入索引
    if (options.url) { query += ' AND url LIKE ?'; params.push(`%${options.url}%`); }
    if (options.notes) { query += ' AND notes LIKE ?'; params.push(`%${options.notes}%`); }
    if (options.groupId) { query += ' AND group_id = ?'; params.push(options.groupId); }
    if (options.dateFrom) { query += ' AND updated_at >= ?'; params.push(options.dateFrom); }
    if (options.dateTo) { query += ' AND updated_at <= ?'; params.push(options.dateTo); }
    query += ' ORDER BY updated_at DESC';
    let rows = this.db.prepare(query).all(...params) as PasswordItem[];
    if (options.username && options.username.trim()) {
      const kw = options.username.trim().toLowerCase();
      rows = rows.filter(p => {
        const unameRaw = p.username;
        const unamePlain = this.isEnc(unameRaw) ? this.crypto.decrypt(unameRaw as any) : (unameRaw || '');
        return unamePlain && unamePlain.toLowerCase().includes(kw);
      });
    }
    return rows.map(p => {
      const unameRaw = p.username;
      const unamePlain = this.isEnc(unameRaw) ? this.crypto.decrypt(unameRaw as any) : (unameRaw || '');
      return {
        ...p,
        username: this.maskUsername(unamePlain),
        password: p.password ? this.crypto.decrypt(p.password) : ''
      } as any;
    });
  }

  /** 根据ID获取单个密码（解密） */
  public getPasswordById(id: number): PasswordItem | null {
    const row = this.db.prepare('SELECT * FROM passwords WHERE id = ?').get(id) as PasswordItem | undefined;
    if (!row) return null;
    const unameRaw = row.username;
    const unamePlain = this.isEnc(unameRaw) ? this.crypto.decrypt(unameRaw as any) : (unameRaw || '');
    return {
      ...row,
      username: unamePlain,
      password: row.password ? this.crypto.decrypt(row.password) : ''
    } as any;
  }


  /** 更新单个密码并记录历史（加密新密码） */
  public updatePassword(id: number, newPassword: string, reason?: string): void {
    const oldRow = this.db.prepare('SELECT password FROM passwords WHERE id = ?').get(id) as { password: string | null } | undefined;
    if (!oldRow) throw new Error('Password not found');
    const oldPlain = oldRow.password ? this.crypto.decrypt(oldRow.password) : '';
    if (oldPlain === newPassword) return;
    const enc = this.crypto.encrypt(newPassword);
    const now = new Date().toISOString();
    this.db.prepare('UPDATE passwords SET password = ?, updated_at = ? WHERE id = ?').run(enc, now, id);
    this.savePasswordHistory(id, oldRow.password!, enc, reason);
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
    if (!hasSingle && !password.id) throw new Error('密码不能为空');
    if (password.url && password.url.length > 2048) throw new Error('URL长度不能超过2048个字符');
    if (password.notes && password.notes.length > 10000) throw new Error('备注长度不能超过10000个字符');

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
