export function getUserSettings(db: any, category?: string) {
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
