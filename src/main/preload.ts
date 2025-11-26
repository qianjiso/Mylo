import { contextBridge, ipcRenderer } from 'electron';

// 定义分组接口
export interface Group {
  id?: number;
  name: string;
  parent_id?: number;
  color?: string;
  order_index?: number;
  sort?: number;
  icon?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GroupWithChildren extends Group {
  children?: GroupWithChildren[];
}

// 定义密码历史记录接口
export interface PasswordHistory {
  id?: number;
  password_id: number;
  old_password: string;
  new_password: string;
  changed_at?: string;
  changed_reason?: string;
}

// 定义用户设置接口
export interface UserSetting {
  id?: number;
  key: string;
  value: string;
  type: string;
  category: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserSettingsCategory {
  category: string;
  description: string;
  settings: string[];
}

// 定义暴露给渲染进程的API接口
export interface ElectronAPI {
  // 密码管理相关
  getPasswords(groupId?: number): Promise<any[]>;
  getPassword(id: number): Promise<any>;
  addPassword(password: any): Promise<{ success: boolean; id: number }>;
  updatePassword(id: number, password: any): Promise<{ success: boolean }>;
  deletePassword(id: number): Promise<{ success: boolean }>;
  searchPasswords(keyword: string): Promise<any[]>;
  advancedSearch(options: any): Promise<any[]>;
  
  // 多账号密码管理
  getPasswordMultiAccounts(id: number): Promise<string | null>;
  setPasswordMultiAccounts(id: number, accounts: string): Promise<{ success: boolean; error?: string }>;
  updatePasswordWithHistory(id: number, newPassword: string, reason?: string): Promise<{ success: boolean; error?: string }>;
  
  // 密码历史记录
  getPasswordHistory(passwordId: number): Promise<PasswordHistory[]>;
  getPasswordsNeedingUpdate(): Promise<any[]>;
  addPasswordHistory(history: PasswordHistory): Promise<{ success: boolean; id: number; error?: string }>;
  getHistoryById(id: number): Promise<PasswordHistory | undefined>;
  deleteHistory(id: number): Promise<{ success: boolean; error?: string }>;
  cleanOldHistory(daysToKeep?: number): Promise<{ success: boolean; count: number; error?: string }>;
  
  // 分组管理
  getGroups(): Promise<Group[]>;
  getGroupTree(parentId?: number): Promise<GroupWithChildren[]>;
  getGroupById(id: number): Promise<Group | undefined>;
  getGroupByName(name: string, parentId?: number): Promise<Group | undefined>;
  addGroup(group: Group): Promise<{ success: boolean; id: number }>;
  updateGroup(id: number, group: Group): Promise<{ success: boolean }>;
  deleteGroup(id: number): Promise<{ success: boolean }>;
  
  
  // 用户设置
  getUserSettings(category?: string): Promise<UserSetting[]>;
  getUserSetting(key: string): Promise<UserSetting | null>;
  setUserSetting(key: string, value: string, type?: string, category?: string, description?: string): Promise<{ success: boolean; error?: string }>;
  updateUserSetting(key: string, value: string): Promise<{ success: boolean; error?: string }>;
  deleteUserSetting(key: string): Promise<{ success: boolean; error?: string }>;
  getUserSettingsCategories(): Promise<UserSettingsCategory[]>;
  resetSettingToDefault(key: string): Promise<{ success: boolean; error?: string }>;
  resetAllSettingsToDefault(): Promise<{ success: boolean; count: number; error?: string }>;
  importSettings(settings: UserSetting[]): Promise<{ success: boolean; count: number; error?: string }>;
  exportSettings(categories?: string[]): Promise<{ success: boolean; data?: string; error?: string }>;
  
  // 密码生成
  generatePassword(options: { 
    length?: number; 
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
  }): Promise<string>;
  
  // 系统相关
  getVersion(): Promise<string>;
  quit(): void;
  minimizeWindow(): Promise<void>;
  toggleMaximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  
  // 数据完整性检查
  checkDataIntegrity(): Promise<{
    success: boolean;
    data?: {
      isValid: boolean;
      errors: string[];
      warnings: string[];
    };
    error?: string;
  }>;

  // 数据完整性修复
  repairDataIntegrity(): Promise<{
    success: boolean;
    data?: {
      repaired: string[];
      failed: string[];
    };
    error?: string;
  }>;

  // 文件操作
  exportData: (options: {
    format: 'json' | 'csv' | 'encrypted_zip';
    includeHistory: boolean;
    includeGroups: boolean;
    includeSettings: boolean;
    passwordStrength: 'weak' | 'medium' | 'strong';
    compressionLevel: number;
  }) => Promise<{ success: boolean; data?: number[]; error?: string }>;
  
  importData: (data: number[], options: {
    format: 'json' | 'csv';
    mergeStrategy: 'replace' | 'merge' | 'skip';
    validateIntegrity: boolean;
    dryRun: boolean;
  }) => Promise<{ success: boolean; data?: any; error?: string }>;

  getNoteGroups(): Promise<any[]>;
  getNoteGroupTree(parentId?: number): Promise<any[]>;
  addNoteGroup(group: any): Promise<{ success: boolean; id: number; error?: string }>;
  updateNoteGroup(id: number, group: any): Promise<{ success: boolean; error?: string }>;
  deleteNoteGroup(id: number): Promise<{ success: boolean; error?: string }>;
  getNotes(groupId?: number): Promise<any[]>;
  getNote(id: number): Promise<any>;
  addNote(note: any): Promise<{ success: boolean; id: number; error?: string }>;
  updateNote(id: number, note: any): Promise<{ success: boolean; error?: string }>;
  deleteNote(id: number): Promise<{ success: boolean; error?: string }>;
  searchNotesTitle(keyword: string): Promise<any[]>;
}

// 将API暴露给渲染进程
const electronAPI: ElectronAPI = {
  // 密码管理相关
  getPasswords: (groupId) => ipcRenderer.invoke('get-passwords', groupId),
  getPassword: (id) => ipcRenderer.invoke('get-password', id),
  addPassword: (password) => ipcRenderer.invoke('add-password', password),
  updatePassword: (id, password) => ipcRenderer.invoke('update-password', id, password),
  deletePassword: (id) => ipcRenderer.invoke('delete-password', id),
  searchPasswords: (keyword) => ipcRenderer.invoke('search-passwords', keyword),
  advancedSearch: (options: any) => ipcRenderer.invoke('advanced-search', options),
  
  // 数据完整性检查
  checkDataIntegrity: () => ipcRenderer.invoke('check-data-integrity'),

  // 数据完整性修复
  repairDataIntegrity: () => ipcRenderer.invoke('repair-data-integrity'),
  
  // 多账号密码管理
  getPasswordMultiAccounts: (id) => ipcRenderer.invoke('get-password-multi-accounts', id),
  setPasswordMultiAccounts: (id, accounts) => ipcRenderer.invoke('set-password-multi-accounts', id, accounts),
  updatePasswordWithHistory: (id, newPassword, reason) => ipcRenderer.invoke('update-password-with-history', id, newPassword, reason),
  
  // 密码历史记录
  getPasswordHistory: (passwordId) => ipcRenderer.invoke('get-password-history', passwordId),
  getPasswordsNeedingUpdate: () => ipcRenderer.invoke('get-passwords-needing-update'),
  addPasswordHistory: (history) => ipcRenderer.invoke('add-password-history', history),
  getHistoryById: (id) => ipcRenderer.invoke('get-history-by-id', id),
  deleteHistory: (id) => ipcRenderer.invoke('delete-history', id),
  cleanOldHistory: (daysToKeep) => ipcRenderer.invoke('clean-old-history', daysToKeep),
  
  // 分组管理
  getGroups: () => ipcRenderer.invoke('get-groups'),
  getGroupTree: (parentId) => ipcRenderer.invoke('get-group-tree', parentId),
  getGroupById: (id) => ipcRenderer.invoke('get-group-by-id', id),
  getGroupByName: (name, parentId) => ipcRenderer.invoke('get-group-by-name', name, parentId),
  addGroup: (group) => ipcRenderer.invoke('add-group', group),
  updateGroup: (id, group) => ipcRenderer.invoke('update-group', id, group),
  deleteGroup: (id) => ipcRenderer.invoke('delete-group', id),
  
  // 用户设置
  getUserSettings: (category) => ipcRenderer.invoke('get-user-settings', category),
  getUserSetting: (key) => ipcRenderer.invoke('get-user-setting', key),
  setUserSetting: (key, value, type, category, description) => ipcRenderer.invoke('set-user-setting', key, value, type, category, description),
  updateUserSetting: (key, value) => ipcRenderer.invoke('update-user-setting', key, value),
  deleteUserSetting: (key) => ipcRenderer.invoke('delete-user-setting', key),
  getUserSettingsCategories: () => ipcRenderer.invoke('get-user-settings-categories'),
  resetSettingToDefault: (key) => ipcRenderer.invoke('reset-setting-to-default', key),
  resetAllSettingsToDefault: () => ipcRenderer.invoke('reset-all-settings-to-default'),
  importSettings: (settings) => ipcRenderer.invoke('import-settings', settings),
  exportSettings: (categories) => ipcRenderer.invoke('export-settings', categories),
  
  // 密码生成
  generatePassword: (options) => ipcRenderer.invoke('generate-password', options),
  
  // 系统相关
  getVersion: () => ipcRenderer.invoke('get-version'),
  quit: () => ipcRenderer.invoke('quit'),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window-toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  
  // 文件操作
  exportData: (options) => ipcRenderer.invoke('export-data', options),
  importData: (data, options) => ipcRenderer.invoke('import-data', data, options)
  ,
  getNoteGroups: () => ipcRenderer.invoke('get-note-groups'),
  getNoteGroupTree: (parentId) => ipcRenderer.invoke('get-note-group-tree', parentId),
  addNoteGroup: (group) => ipcRenderer.invoke('add-note-group', group),
  updateNoteGroup: (id, group) => ipcRenderer.invoke('update-note-group', id, group),
  deleteNoteGroup: (id) => ipcRenderer.invoke('delete-note-group', id),
  getNotes: (groupId) => ipcRenderer.invoke('get-notes', groupId),
  getNote: (id) => ipcRenderer.invoke('get-note', id),
  addNote: (note) => ipcRenderer.invoke('add-note', note),
  updateNote: (id, note) => ipcRenderer.invoke('update-note', id, note),
  deleteNote: (id) => ipcRenderer.invoke('delete-note', id),
  searchNotesTitle: (keyword) => ipcRenderer.invoke('search-notes-title', keyword)
};

// 使用 contextBridge 安全地暴露API
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 类型声明，供渲染进程使用
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
