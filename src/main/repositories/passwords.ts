export function getPasswords(db: any, groupId?: number) {
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

export function getPasswordById(db: any, id: number) {
  const stmt = db.prepare('SELECT * FROM passwords WHERE id = ?');
  return stmt.get(id);
}
