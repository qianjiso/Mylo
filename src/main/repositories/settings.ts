/** 获取用户设置列表，可按类别过滤 */
import type Database from 'better-sqlite3';

export function getUserSettings(db: Database.Database, category?: string) {
  let query = 'SELECT * FROM user_settings';
  const params: any[] = [];
  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }
  query += ' ORDER BY category, key';
  const stmt = db.prepare(query);
  return stmt.all(...params);
}
