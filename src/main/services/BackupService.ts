import type Database from 'better-sqlite3';
import archiver from 'archiver';
import zipEncrypted from 'archiver-zip-encrypted';
import { PassThrough } from 'stream';
import GroupService from './GroupService';
import PasswordService from './PasswordService';
import SettingsService from './SettingsService';
import NoteService from './NoteService';
import { Group, PasswordItem, PasswordHistory, UserSetting, SecureRecord, SecureRecordGroup } from '../../shared/types';

export default class BackupService {
  private db: Database.Database;
  private crypto: { encrypt: (t: string) => string; decrypt: (t: string) => string };
  private groups: GroupService;
  private passwords: PasswordService;
  private settings: SettingsService;
  private notes: NoteService;

  constructor(db: Database.Database, crypto: { encrypt: (t: string) => string; decrypt: (t: string) => string }, groups: GroupService, passwords: PasswordService, settings: SettingsService, notes: NoteService) {
    this.db = db;
    this.crypto = crypto;
    this.groups = groups;
    this.passwords = passwords;
    this.settings = settings;
    this.notes = notes;
  }

  public async exportData(options: {
    format: 'json' | 'encrypted_zip';
    includeHistory?: boolean;
    includeGroups?: boolean;
    includeSettings?: boolean;
    archivePassword?: string;
  }): Promise<Uint8Array> {
    const data: any = { version: '1.0', exported_at: new Date().toISOString(), app_name: 'Password Manager' };
    const passwords = this.passwords.getPasswords();
    data.passwords = passwords.map(p => ({ ...p, password: p.password ? p.password : null }));
    const includeGroups = options.includeGroups ?? true;
    if (includeGroups) {
      data.groups = this.groups.getGroups();
      data.note_groups = this.notes.getNoteGroups();
    }
    const includeSettings = options.includeSettings ?? true;
    if (includeSettings) {
      data.user_settings = this.settings.exportSettings();
    }
    const includeHistory = options.includeHistory ?? true;
    if (includeHistory) {
      const rows = this.db.prepare('SELECT * FROM password_history').all();
      data.password_history = (rows as any[]).map(h => ({ ...h, old_password: this.crypto.encrypt(h.old_password), new_password: this.crypto.encrypt(h.new_password) }));
    }
    data.notes = this.notes.getNotes();
    if (options.format === 'json') {
      return new TextEncoder().encode(JSON.stringify(data, null, 2));
    }
    if (!options.archivePassword || options.archivePassword.length < 4) {
      throw new Error('请为加密备份包设置至少4位的密码');
    }
    return await this.createZipArchive(data, options.archivePassword);
  }

  public async importData(data: Uint8Array, options: {
    format: 'json';
    mergeStrategy: 'replace' | 'merge' | 'skip';
    validateIntegrity: boolean;
    dryRun: boolean;
  }): Promise<{ success: boolean; imported: number; skipped: number; errors: string[]; warnings: string[] }> {
    const result = { success: true, imported: 0, skipped: 0, errors: [] as string[], warnings: [] as string[] };
    const json = new TextDecoder().decode(data);
    const payload: any = JSON.parse(json);
    if (options.validateIntegrity) {
      const v = this.validateImportData(payload);
      if (!v.isValid) {
        result.errors.push(...v.errors);
        result.success = false;
        return result;
      }
      result.warnings.push(...v.warnings);
    }
    if (options.dryRun) return result;
    if (options.mergeStrategy === 'replace') await this.clearAllData();

    const groupIdMap = new Map<number, number>();
    if (payload.groups && payload.groups.length > 0) {
      const pending = [...payload.groups];
      while (pending.length > 0) {
        let progressed = false;
        for (let i = 0; i < pending.length; i++) {
          const g = pending[i];
          try {
            this.groups.validateGroup(g as Group);
            const parentOld = g.parent_id ?? null;
            const parentNew = parentOld == null ? null : (groupIdMap.get(parentOld) ?? parentOld);
            const parentOk = parentNew == null || !!this.groups.getGroupById(parentNew);
            if (!parentOk) continue;
            const byId = g.id ? this.groups.getGroupById(g.id) : undefined;
            const byName = this.groups.getGroupByName(g.name, parentNew ?? undefined);
            if (options.mergeStrategy === 'skip' && (byId || byName)) {
              const mapped = (byId?.id ?? byName?.id);
              if (typeof g.id === 'number' && mapped) groupIdMap.set(g.id, mapped);
              result.skipped++;
              pending.splice(i, 1);
              progressed = true;
              i--;
              continue;
            }
            let savedId: number;
            if (byId) {
              savedId = this.groups.saveGroupFromImport({ ...g, id: byId.id, parent_id: parentNew ?? undefined } as Group);
            } else if (byName) {
              savedId = this.groups.saveGroupFromImport({ ...g, id: byName.id, parent_id: parentNew ?? undefined } as Group);
            } else {
              savedId = this.groups.saveGroupFromImport({ name: g.name, parent_id: parentNew ?? undefined, color: g.color, sort: g.sort } as Group);
            }
            if (typeof g.id === 'number') groupIdMap.set(g.id, savedId);
            result.imported++;
            pending.splice(i, 1);
            progressed = true;
            i--;
          } catch {
            continue;
          }
        }
        if (!progressed) {
          for (const g of pending) result.errors.push(`导入分组失败（父分组缺失或非法）: ${g.name}`);
          break;
        }
      }
    }

    const noteGroupIdMap = new Map<number, number>();
    if (payload.note_groups && payload.note_groups.length > 0) {
      const pendingNG = [...payload.note_groups];
      while (pendingNG.length > 0) {
        let progressed = false;
        for (let i = 0; i < pendingNG.length; i++) {
          const ng = pendingNG[i];
          try {
            const parentOld = ng.parent_id ?? null;
            const parentNew = parentOld == null ? null : (noteGroupIdMap.get(parentOld) ?? parentOld);
            const row = this.db.prepare('SELECT id FROM secure_record_groups WHERE name = ? AND (parent_id IS ? OR parent_id = ?)').get(ng.name, parentNew ?? null, parentNew ?? null) as { id?: number } | undefined;
            let newId: number;
            if (row && row.id) {
              newId = row.id;
            } else {
              newId = this.notes.saveNoteGroupFromImport({ name: ng.name, parent_id: parentNew ?? null, color: ng.color || 'blue', sort_order: ng.sort_order || 0 } as SecureRecordGroup);
            }
            if (typeof ng.id === 'number') noteGroupIdMap.set(ng.id, newId);
            result.imported++;
            pendingNG.splice(i, 1);
            progressed = true;
            i--;
          } catch {
            continue;
          }
        }
        if (!progressed) {
          for (const ng of pendingNG) result.errors.push(`导入便签分组失败（父分组缺失或非法）: ${ng.name}`);
          break;
        }
      }
    }

    if (payload.notes && payload.notes.length > 0) {
      for (const note of payload.notes) {
        try {
          const gid = typeof note.group_id === 'number' ? (noteGroupIdMap.get(note.group_id) || note.group_id) : null;
          const existed = note.id ? this.notes.getNoteById(note.id) : null;
          if (options.mergeStrategy === 'skip' && existed) { result.skipped++; continue; }
          this.notes.saveNoteFromImport({ id: note.id, title: note.title || null, content_ciphertext: note.content_ciphertext, group_id: gid || null, pinned: !!note.pinned, archived: !!note.archived } as SecureRecord);
          result.imported++;
        } catch (error) {
          result.errors.push(`导入便签失败: ${note.title || ''} - ${error}`);
        }
      }
    }

    if (payload.passwords && payload.passwords.length > 0) {
      const existingPasswords = this.passwords.getPasswords();
      for (const password of payload.passwords) {
        try {
          this.passwords.validatePassword(password as PasswordItem);
          const existing = password.id ? existingPasswords.find(p => p.id === password.id) : undefined;
          if (options.mergeStrategy === 'skip' && (existing || existingPasswords.find(p => p.title === password.title))) { result.skipped++; continue; }
          if (typeof password.group_id === 'number') {
            const mapped = groupIdMap.get(password.group_id);
            if (mapped) password.group_id = mapped;
          }
          if (password.password && !String(password.password).includes(':')) {
            password.password = this.crypto.encrypt(password.password);
          }
          this.passwords.savePasswordFromImport(password as PasswordItem);
          result.imported++;
        } catch (error) {
          result.errors.push(`导入密码失败: ${password.title} - ${error}`);
        }
      }
    }

    if (payload.user_settings && payload.user_settings.length > 0) {
      for (const s of payload.user_settings) {
        try {
          this.settings.validateUserSetting(s as UserSetting);
          this.settings.importSettings([s as UserSetting]);
          result.imported++;
        } catch (error) {
          result.errors.push(`导入设置失败: ${s.key} - ${error}`);
        }
      }
    }

    if (payload.password_history && payload.password_history.length > 0) {
      for (const h of payload.password_history) {
        try {
          if (h.old_password && !String(h.old_password).includes(':')) h.old_password = this.crypto.encrypt(h.old_password);
          if (h.new_password && !String(h.new_password).includes(':')) h.new_password = this.crypto.encrypt(h.new_password);
          this.passwords.addPasswordHistory(h as PasswordHistory);
          result.imported++;
        } catch (error) {
          result.errors.push(`导入历史记录失败: ${h.password_id} - ${error}`);
        }
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private validateImportData(data: any): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      if (data.version && !this.isVersionCompatible(data.version)) errors.push(`不支持的导出数据版本: ${data.version}`);
      if (!data.passwords || !Array.isArray(data.passwords)) errors.push('缺少密码数据或格式不正确');
      if (data.passwords) {
        for (const p of data.passwords) {
          if (!p.title || !p.username) errors.push(`密码条目缺少必要字段: ${JSON.stringify(p)}`);
        }
      }
      if (data.groups) {
        for (const g of data.groups) {
          if (!g.name) errors.push(`分组缺少名称: ${JSON.stringify(g)}`);
        }
      }
      if (data.passwords && data.passwords.length > 10000) warnings.push(`导入数据量较大 (${data.passwords.length} 条密码)，可能需要较长时间`);
    } catch (error) {
      errors.push(`数据验证失败: ${error}`);
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  private isVersionCompatible(version: string): boolean {
    const supported = ['1.0'];
    return supported.includes(version);
  }

  private async clearAllData(): Promise<void> {
    this.db.prepare('DELETE FROM password_history').run();
    this.db.prepare('DELETE FROM passwords').run();
    this.db.prepare('DELETE FROM groups').run();
    this.db.prepare('DELETE FROM user_settings').run();
  }

  private async createZipArchive(data: any, archivePassword?: string): Promise<Uint8Array> {
    if (archivePassword) archiver.registerFormat('zip-encrypted', zipEncrypted as any);
    const archive = archivePassword ? archiver.create('zip-encrypted', { zlib: { level: 6 }, encryptionMethod: 'zip20', password: archivePassword }) : archiver.create('zip', { zlib: { level: 6 } });
    const out = new PassThrough();
    const chunks: Buffer[] = [];
    out.on('data', (d: Buffer) => chunks.push(d));
    const onError = (err: any) => { throw err; };
    archive.on('error', onError);
    archive.pipe(out);
    const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
    archive.append(content, { name: 'backup.json' });
    archive.append(Buffer.from(JSON.stringify({ exported_at: new Date().toISOString() }, null, 2), 'utf8'), { name: 'meta.json' });
    await archive.finalize();
    const streamMod = await import('stream');
    await new Promise<void>((resolve, reject) => { (streamMod as any).finished(out, (err: any) => err ? reject(err) : resolve()); });
    return new Uint8Array(Buffer.concat(chunks));
  }
}
