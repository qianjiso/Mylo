/** 获取所有分组，按父子和排序字段进行排序 */
import type Database from 'better-sqlite3';

export function getGroups(db: Database.Database) {
  const stmt = db.prepare('SELECT * FROM groups ORDER BY parent_id IS NOT NULL, parent_id, sort ASC, created_at ASC');
  return stmt.all();
}

/** 根据分组ID获取分组记录 */
export function getGroupById(db: Database.Database, id: number) {
  const stmt = db.prepare('SELECT * FROM groups WHERE id = ?');
  return stmt.get(id);
}
