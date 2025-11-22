/** 获取密码列表，可按分组过滤，按更新时间/创建时间倒序 */
import type Database from 'better-sqlite3';

export function getPasswords(db: Database.Database, groupId?: number) {
  let query = 'SELECT * FROM passwords';
  const params: any[] = [];
  if (groupId) {
    query += ' WHERE group_id = ?';
    params.push(groupId);
  }
  query += ' ORDER BY updated_at DESC, created_at DESC';
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

/** 根据ID获取单个密码记录 */
export function getPasswordById(db: Database.Database, id: number) {
  const stmt = db.prepare('SELECT * FROM passwords WHERE id = ?');
  return stmt.get(id);
}
