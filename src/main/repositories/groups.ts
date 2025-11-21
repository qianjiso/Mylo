export function getGroups(db: any) {
  const stmt = db.prepare('SELECT * FROM groups ORDER BY parent_id IS NOT NULL, parent_id, sort ASC, created_at ASC');
  return stmt.all();
}

export function getGroupById(db: any, id: number) {
  const stmt = db.prepare('SELECT * FROM groups WHERE id = ?');
  return stmt.get(id);
}
