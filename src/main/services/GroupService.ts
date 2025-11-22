import type Database from 'better-sqlite3';
import * as GroupsRepo from '../repositories/groups';

export interface Group {
  id?: number;
  name: string;
  parent_id?: number;
  color?: string;
  order_index?: number;
  sort?: number;
  created_at?: string;
  updated_at?: string;
}

export interface GroupWithChildren extends Group {
  children: GroupWithChildren[];
}

/**
 * 分组模块服务，负责分组的查询、保存、删除及树结构维护
 */
export class GroupService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureOrderAndSortColumns();
  }

  /** 获取所有分组列表（包含默认颜色补全） */
  public getGroups(): Group[] {
    const groups = GroupsRepo.getGroups(this.db) as Group[];
    return groups.map(g => ({ ...g, color: g.color || 'blue' }));
  }

  /** 根据父分组ID构建树形结构（为空表示根） */
  public getGroupWithChildren(parentId?: number): GroupWithChildren[] {
    const groups = this.getGroups();
    return this.buildGroupTree(groups, parentId);
  }

  /** 保存分组（新增/更新），保证名称唯一、无循环引用、排序正确 */
  public saveGroup(group: Group): number {
    this.validateGroup(group);

    const existing = this.getGroupByName(group.name, group.parent_id);
    if (existing && existing.id !== group.id) {
      throw new Error('分组名称已存在');
    }

    if (group.parent_id) {
      this.validateForeignKey('groups', group.parent_id);
      if (group.id) {
        this.validateNoCircularReference(group.id, group.parent_id);
      }
    }

    const now = new Date().toISOString();
    const color = group.color || 'blue';
    const parentId = group.parent_id ?? null;

    if (group.id) {
      const current = this.db.prepare('SELECT parent_id, sort FROM groups WHERE id = ?').get(group.id) as { parent_id?: number; sort: number } | undefined;
      let sortValue = group.sort ?? current?.sort ?? 0;
      if (current && (current.parent_id ?? null) !== parentId) {
        if (group.sort == null) {
          sortValue = this.getNextGroupSort(parentId ?? undefined);
        }
      }

      const stmt = this.db.prepare(
        `UPDATE groups SET name = ?, parent_id = ?, color = ?, sort = ?, updated_at = ? WHERE id = ?`
      );
      stmt.run(group.name, parentId, color, sortValue, now, group.id);
      return group.id;
    } else {
      const sortValue = group.sort ?? this.getNextGroupSort(parentId ?? undefined);
      const stmt = this.db.prepare(
        `INSERT INTO groups (name, parent_id, color, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      );
      const result = stmt.run(group.name, parentId, color, sortValue, now, now);
      return result.lastInsertRowid as number;
    }
  }

  /** 根据名称与父ID查询分组（颜色补全） */
  public getGroupByName(name: string, parentId?: number): Group | undefined {
    const stmt = this.db.prepare('SELECT * FROM groups WHERE name = ? AND parent_id = ?');
    const result = stmt.get(name, parentId || null) as Group | undefined;
    if (result) result.color = result.color || 'blue';
    return result;
  }

  /** 根据ID查询分组 */
  public getGroupById(id: number): Group | undefined {
    const stmt = this.db.prepare('SELECT * FROM groups WHERE id = ?');
    return stmt.get(id) as Group | undefined;
  }

  /** 删除分组并在删除后重算排序 */
  public deleteGroup(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM groups WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes > 0) this.recalculateGroupOrder();
    return result.changes > 0;
  }

  /** 验证分组数据的合法性（名称、颜色等） */
  public validateGroup(group: Group): void {
    if (!group.name || group.name.trim().length === 0) {
      throw new Error('分组名称不能为空');
    }
    if (group.name.length > 100) {
      throw new Error('分组名称长度不能超过100个字符');
    }
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(group.name)) {
      throw new Error('分组名称不能包含以下字符: < > : " / \\ | ? *');
    }
    const validColors = ['blue', 'green', 'red', 'yellow', 'purple', 'orange', 'pink', 'gray', 'cyan', 'teal'];
    if (group.color && !validColors.includes(group.color)) {
      throw new Error('无效的分组颜色');
    }
  }

  /** 检查外键是否存在（当前仅支持 groups） */
  public validateForeignKey(tableName: string, id: number): void {
    switch (tableName) {
      case 'groups': {
        const row = this.db.prepare('SELECT id FROM groups WHERE id = ?').get(id);
        if (!row) throw new Error('指定的分组不存在');
        break;
      }
      default:
        throw new Error(`未知的表名: ${tableName}`);
    }
  }

  /** 防止创建分组循环引用（子指向祖先） */
  public validateNoCircularReference(groupId: number, parentId?: number): void {
    if (!parentId) return;
    let currentId: number | undefined = parentId;
    const visited = new Set<number>();
    while (currentId) {
      if (currentId === groupId) throw new Error('不能创建循环引用的分组结构');
      if (visited.has(currentId)) throw new Error('检测到分组循环引用');
      visited.add(currentId);
      const res = this.db.prepare('SELECT parent_id FROM groups WHERE id = ?').get(currentId) as { parent_id?: number } | undefined;
      currentId = res?.parent_id;
    }
  }

  /** 递归构建分组树结构（按 sort 排序） */
  private buildGroupTree(groups: Group[], parentId?: number): GroupWithChildren[] {
    const targetParentId = parentId === undefined ? null : parentId;
    return groups
      .filter(g => (g.parent_id ?? null) === targetParentId)
      .sort((a, b) => (a.sort || 0) - (b.sort || 0))
      .map(g => ({
        ...g,
        color: g.color || 'blue',
        children: g.id ? this.buildGroupTree(groups, g.id) : []
      }));
  }

  /** 确保分组表包含排序相关列，并在需要时重算 */
  private ensureOrderAndSortColumns(): void {
    const columns = this.db.prepare('PRAGMA table_info(groups)').all() as Array<{ name: string }>;
    const hasOrder = columns.some(c => c.name === 'order_index');
    const hasSort = columns.some(c => c.name === 'sort');
    if (!hasOrder) {
      this.db.prepare('ALTER TABLE groups ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0').run();
      this.recalculateGroupOrder();
    }
    if (!hasSort) {
      this.db.prepare('ALTER TABLE groups ADD COLUMN sort INTEGER NOT NULL DEFAULT 0').run();
      this.db.prepare('UPDATE groups SET sort = order_index').run();
    }
  }

  /** 重算每个父分组下的排序序号 */
  private recalculateGroupOrder(): void {
    const groups = this.db.prepare('SELECT id, parent_id FROM groups ORDER BY created_at ASC').all() as Array<{ id: number; parent_id?: number }>; 
    const parentCounters = new Map<number | null, number>();
    const updateOrder = this.db.prepare('UPDATE groups SET order_index = ? WHERE id = ?');
    const updateSort = this.db.prepare('UPDATE groups SET sort = ? WHERE id = ?');
    for (const g of groups) {
      const parentKey = g.parent_id ?? null;
      const idx = parentCounters.get(parentKey) ?? 0;
      updateOrder.run(idx, g.id);
      updateSort.run(idx, g.id);
      parentCounters.set(parentKey, idx + 1);
    }
  }

  /** 获取指定父分组下下一个 sort 值 */
  private getNextGroupSort(parentId?: number): number {
    const row = parentId == null
      ? (this.db.prepare('SELECT COALESCE(MAX(sort), -1) AS max_sort FROM groups WHERE parent_id IS NULL').get() as { max_sort: number })
      : (this.db.prepare('SELECT COALESCE(MAX(sort), -1) AS max_sort FROM groups WHERE parent_id = ?').get(parentId) as { max_sort: number });
    return (row.max_sort ?? -1) + 1;
  }
}

export default GroupService;
