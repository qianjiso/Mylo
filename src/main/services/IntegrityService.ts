import type Database from 'better-sqlite3';

export default class IntegrityService {
  private db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  public check(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      this.checkForeignKeys(errors);
      this.checkUniqueness(errors);
      this.checkFormats(errors, warnings);
      this.checkCycles(errors);
      this.checkOrphans(warnings);
    } catch (error) {
      errors.push(`数据完整性检查失败: ${error}`);
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  public repair(): { repaired: string[]; failed: string[] } {
    const repaired: string[] = [];
    const failed: string[] = [];
    try {
      const r1 = this.db.prepare('UPDATE passwords SET group_id = NULL WHERE group_id IS NOT NULL AND group_id NOT IN (SELECT id FROM groups)').run();
      if (r1.changes > 0) repaired.push(`修复了 ${r1.changes} 条密码记录的无效分组引用`);
      const r2 = this.db.prepare('DELETE FROM password_history WHERE password_id NOT IN (SELECT id FROM passwords)').run();
      if (r2.changes > 0) repaired.push(`删除了 ${r2.changes} 条无效的密码历史记录`);
      const dupSettings = this.db.prepare('SELECT key, MAX(updated_at) as latest_updated_at FROM user_settings GROUP BY key HAVING COUNT(*) > 1').all() as any[];
      for (const s of dupSettings) {
        const d = this.db.prepare('DELETE FROM user_settings WHERE key = ? AND updated_at != ?').run((s as any).key, (s as any).latest_updated_at);
        if (d.changes > 0) repaired.push(`清理了用户设置 "${(s as any).key}" 的 ${d.changes} 个重复项`);
      }
      const dupGroups = this.db.prepare('SELECT name, parent_id, COUNT(*) as count FROM groups GROUP BY name, parent_id HAVING COUNT(*) > 1').all() as any[];
      for (const g of dupGroups) {
        const rows = this.db.prepare('SELECT id, name FROM groups WHERE name = ? AND parent_id = ? ORDER BY id').all((g as any).name, (g as any).parent_id);
        for (let i = 1; i < (rows as any[]).length; i++) {
          const newName = `${(g as any).name}_${i}`;
          const u = this.db.prepare('UPDATE groups SET name = ?, updated_at = ? WHERE id = ?').run(newName, new Date().toISOString(), (rows as any[])[i].id);
          if (u.changes > 0) repaired.push(`重命名重复分组 "${(g as any).name}" 为 "${newName}"`);
        }
      }
    } catch (error) {
      failed.push(`数据修复失败: ${error}`);
    }
    return { repaired, failed };
  }

  private checkForeignKeys(errors: string[]): void {
    const badPwdGroups = this.db.prepare('SELECT p.id, p.title, p.group_id FROM passwords p LEFT JOIN groups g ON p.group_id = g.id WHERE p.group_id IS NOT NULL AND g.id IS NULL').all() as any[];
    for (const r of badPwdGroups) errors.push(`密码 "${r.title}" (ID: ${r.id}) 引用了不存在的分组 (ID: ${r.group_id})`);
    const badHistory = this.db.prepare('SELECT ph.id, ph.password_id FROM password_history ph LEFT JOIN passwords p ON ph.password_id = p.id WHERE p.id IS NULL').all() as any[];
    for (const r of badHistory) errors.push(`密码历史记录 (ID: ${r.id}) 引用了不存在的密码 (ID: ${r.password_id})`);
  }

  private checkUniqueness(errors: string[]): void {
    const dupSettings = this.db.prepare('SELECT key, COUNT(*) as count FROM user_settings GROUP BY key HAVING COUNT(*) > 1').all() as any[];
    for (const r of dupSettings) errors.push(`用户设置键 "${r.key}" 重复了 ${r.count} 次`);
    const dupGroups = this.db.prepare('SELECT name, parent_id, COUNT(*) as count FROM groups GROUP BY name, parent_id HAVING COUNT(*) > 1').all() as any[];
    for (const r of dupGroups) {
      const parent = r.parent_id ? `父分组ID: ${r.parent_id}` : '根分组';
      errors.push(`分组名称 "${r.name}" 在 ${parent} 下重复了 ${r.count} 次`);
    }
  }

  private checkFormats(errors: string[], warnings: string[]): void {
    const invalidTs = this.db.prepare(
      "SELECT 'passwords' as table_name, id, created_at, updated_at FROM passwords WHERE created_at NOT LIKE '%-%-%T%:%:%.%Z' OR updated_at NOT LIKE '%-%-%T%:%:%.%Z' UNION ALL SELECT 'groups' as table_name, id, created_at, updated_at FROM groups WHERE created_at NOT LIKE '%-%-%T%:%:%.%Z' OR updated_at NOT LIKE '%-%-%T%:%:%.%Z' UNION ALL SELECT 'password_history' as table_name, id, changed_at as created_at, changed_at as updated_at FROM password_history WHERE changed_at NOT LIKE '%-%-%T%:%:%.%Z'"
    ).all() as any[];
    for (const r of invalidTs) errors.push(`${r.table_name} 表中的记录 (ID: ${r.id}) 时间戳格式不正确`);
    const emptyFields = this.db.prepare(
      "SELECT 'passwords' as table_name, id, 'title' as field_name FROM passwords WHERE title IS NULL OR title = '' UNION ALL SELECT 'passwords' as table_name, id, 'username' as field_name FROM passwords WHERE username IS NULL OR username = '' UNION ALL SELECT 'passwords' as table_name, id, 'password' as field_name FROM passwords WHERE password IS NULL OR password = '' UNION ALL SELECT 'groups' as table_name, id, 'name' as field_name FROM groups WHERE name IS NULL OR name = '' UNION ALL SELECT 'user_settings' as table_name, id, 'key' as field_name FROM user_settings WHERE key IS NULL OR key = '' UNION ALL SELECT 'user_settings' as table_name, id, 'value' as field_name FROM user_settings WHERE value IS NULL OR value = ''"
    ).all() as any[];
    for (const r of emptyFields) errors.push(`${r.table_name} 表中的记录 (ID: ${r.id}) 必填字段 ${r.field_name} 为空`);
    const longFields = this.db.prepare(
      "SELECT 'passwords' as table_name, id, 'title' as field_name, LENGTH(title) as length FROM passwords WHERE LENGTH(title) > 255 UNION ALL SELECT 'passwords' as table_name, id, 'username' as field_name, LENGTH(username) as length FROM passwords WHERE LENGTH(username) > 255 UNION ALL SELECT 'passwords' as table_name, id, 'url' as field_name, LENGTH(url) as length FROM passwords WHERE LENGTH(url) > 2048 UNION ALL SELECT 'groups' as table_name, id, 'name' as field_name, LENGTH(name) as length FROM groups WHERE LENGTH(name) > 100"
    ).all() as any[];
    for (const r of longFields) warnings.push(`${r.table_name} 表中的记录 (ID: ${r.id}) 字段 ${r.field_name} 长度 ${r.length} 可能过长`);
  }

  private checkCycles(errors: string[]): void {
    const groups = this.db.prepare('SELECT id, name, parent_id FROM groups').all() as Array<{ id: number; name: string; parent_id?: number }>; 
    const visited = new Set<number>();
    const stack = new Set<number>();
    const hasCycle = (id: number): boolean => {
      if (stack.has(id)) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      stack.add(id);
      const g = (groups as any[]).find((x: any) => x.id === id);
      if (g && (g as any).parent_id) {
        if (hasCycle((g as any).parent_id)) return true;
      }
      stack.delete(id);
      return false;
    };
    for (const g of groups) {
      if (!visited.has(g.id) && hasCycle(g.id)) errors.push(`检测到分组循环引用，涉及分组ID: ${g.id} (${g.name})`);
    }
  }

  private checkOrphans(warnings: string[]): void {
    const rows = this.db.prepare('SELECT g.id, g.name FROM groups g LEFT JOIN passwords p ON g.id = p.group_id WHERE p.id IS NULL').all() as Array<{ id: number; name: string }>;
    for (const r of rows) warnings.push(`分组 "${r.name}" (ID: ${r.id}) 没有包含任何密码`);
    const old = this.db.prepare("SELECT COUNT(*) as count FROM password_history WHERE changed_at < datetime('now', '-2 years')").get() as { count: number };
    if (old.count > 0) warnings.push(`发现 ${old.count} 条超过2年的密码历史记录，建议清理`);
  }
}

