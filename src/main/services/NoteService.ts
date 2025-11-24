import type Database from 'better-sqlite3';

export interface SecureRecordGroup {
  id?: number;
  name: string;
  parent_id?: number | null;
  color?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SecureRecord {
  id?: number;
  title?: string | null;
  content_ciphertext: string;
  group_id?: number | null;
  pinned?: boolean;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CryptoAdapter {
  encrypt(text: string): string;
  decrypt(text: string): string;
}

export default class NoteService {
  private db: Database.Database;
  private crypto: CryptoAdapter;

  constructor(db: Database.Database, crypto: CryptoAdapter) {
    this.db = db;
    this.crypto = crypto;
    this.ensureSchema();
  }

  public getNoteGroups(): SecureRecordGroup[] {
    const rows = this.db.prepare('SELECT * FROM secure_record_groups ORDER BY parent_id ASC, sort_order ASC, created_at ASC').all() as SecureRecordGroup[];
    return rows;
  }

  public saveNoteGroup(group: SecureRecordGroup): number {
    if (!group.name || group.name.trim().length === 0) throw new Error('分组名称不能为空');
    const now = new Date().toISOString();
    if (group.id) {
      const stmt = this.db.prepare('UPDATE secure_record_groups SET name = ?, parent_id = ?, color = ?, sort_order = ?, updated_at = ? WHERE id = ?');
      stmt.run(group.name, group.parent_id || null, group.color || 'blue', group.sort_order || 0, now, group.id);
      return group.id;
    } else {
      const stmt = this.db.prepare('INSERT INTO secure_record_groups (name, parent_id, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
      const res = stmt.run(group.name, group.parent_id || null, group.color || 'blue', group.sort_order || 0, now, now);
      return res.lastInsertRowid as number;
    }
  }

  public deleteNoteGroup(id: number): boolean {
    const res = this.db.prepare('DELETE FROM secure_record_groups WHERE id = ?').run(id);
    this.db.prepare('UPDATE secure_records SET group_id = NULL WHERE group_id = ?').run(id);
    return res.changes > 0;
  }

  public getNoteGroupTree(parentId?: number): Array<SecureRecordGroup & { children?: any[] }> {
    const groups = this.getNoteGroups();
    const byParent = new Map<number | null, SecureRecordGroup[]>();
    for (const g of groups) {
      const key = g.parent_id ?? null;
      const arr = byParent.get(key) || [];
      arr.push(g);
      byParent.set(key, arr);
    }
    const build = (pid: number | null): any[] => {
      const children = byParent.get(pid) || [];
      return children.map(ch => ({ ...ch, children: build(ch.id || null) }));
    };
    return build(parentId ?? null);
  }

  public getNotes(groupId?: number): SecureRecord[] {
    const stmt = groupId
      ? this.db.prepare('SELECT * FROM secure_records WHERE group_id = ? ORDER BY updated_at DESC')
      : this.db.prepare('SELECT * FROM secure_records ORDER BY updated_at DESC');
    const rows = groupId ? (stmt.all(groupId) as SecureRecord[]) : (stmt.all() as SecureRecord[]);
    return rows.map(r => ({
      ...r,
      content_ciphertext: this.crypto.decrypt(r.content_ciphertext)
    }));
  }

  public getNoteById(id: number): SecureRecord | null {
    const row = this.db.prepare('SELECT * FROM secure_records WHERE id = ?').get(id) as SecureRecord | undefined;
    if (!row) return null;
    return { ...row, content_ciphertext: this.crypto.decrypt(row.content_ciphertext) };
  }

  public saveNote(note: SecureRecord): number {
    if (!note.content_ciphertext || String(note.content_ciphertext).trim().length === 0) throw new Error('内容不能为空');
    const now = new Date().toISOString();
    const enc = this.crypto.encrypt(note.content_ciphertext);
    if (note.id) {
      const stmt = this.db.prepare('UPDATE secure_records SET title = ?, content_ciphertext = ?, group_id = ?, pinned = ?, archived = ?, updated_at = ? WHERE id = ?');
      stmt.run(note.title || null, enc, note.group_id || null, note.pinned ? 1 : 0, note.archived ? 1 : 0, now, note.id);
      return note.id;
    } else {
      const stmt = this.db.prepare('INSERT INTO secure_records (title, content_ciphertext, group_id, pinned, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const res = stmt.run(note.title || null, enc, note.group_id || null, note.pinned ? 1 : 0, note.archived ? 1 : 0, now, now);
      return res.lastInsertRowid as number;
    }
  }

  public deleteNote(id: number): boolean {
    const res = this.db.prepare('DELETE FROM secure_records WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public searchNotesByTitle(keyword: string): SecureRecord[] {
    const stmt = this.db.prepare('SELECT * FROM secure_records WHERE title LIKE ? ORDER BY updated_at DESC');
    const rows = stmt.all(`%${keyword}%`) as SecureRecord[];
    return rows.map(r => ({ ...r, content_ciphertext: this.crypto.decrypt(r.content_ciphertext) }));
  }

  private ensureSchema(): void {
    const gCols = this.db.prepare('PRAGMA table_info(secure_record_groups)').all() as Array<{ name: string }>;
    if (gCols.length === 0) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS secure_record_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          parent_id INTEGER,
          color TEXT DEFAULT 'blue',
          sort_order INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_secure_record_groups_parent ON secure_record_groups(parent_id);
        CREATE INDEX IF NOT EXISTS idx_secure_record_groups_sort ON secure_record_groups(parent_id, sort_order);
      `);
    }
    const rCols = this.db.prepare('PRAGMA table_info(secure_records)').all() as Array<{ name: string }>;
    if (rCols.length === 0) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS secure_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          content_ciphertext TEXT NOT NULL,
          group_id INTEGER,
          pinned INTEGER DEFAULT 0,
          archived INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_secure_records_group ON secure_records(group_id);
        CREATE INDEX IF NOT EXISTS idx_secure_records_updated ON secure_records(updated_at DESC);
      `);
    }
  }
}

