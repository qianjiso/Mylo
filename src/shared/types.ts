export interface PasswordItem {
  id?: number;
  title: string;
  username: string;
  password?: string | null;
  url?: string | null;
  notes?: string | null;
  group_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface PasswordHistory {
  id?: number;
  password_id: number;
  old_password: string;
  new_password: string;
  changed_at?: string;
  changed_reason?: string;
}

export interface Group {
  id?: number;
  name: string;
  parent_id?: number;
  color?: string;
  icon?: string;
  order_index?: number;
  sort?: number;
  created_at?: string;
  updated_at?: string;
}

export interface GroupWithChildren extends Group {
  children: GroupWithChildren[];
}

export interface SecureRecordGroup {
  id?: number;
  name: string;
  parent_id?: number | null;
  color?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SecureRecord {
  id?: number;
  title?: string | null;
  content_ciphertext: string;
  group_id?: number | null;
  pinned?: boolean;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserSetting {
  id?: number;
  key: string;
  value: string;
  type?: 'string' | 'number' | 'boolean' | 'json';
  category?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserSettingsCategory {
  category: string;
  description: string;
  settings: string[];
}

export type ExportOptions = {
  format: 'json' | 'encrypted_zip';
  includeHistory?: boolean;
  includeGroups?: boolean;
  includeSettings?: boolean;
  archivePassword?: string;
};

export type ImportOptions = {
  format: 'json';
  mergeStrategy: 'replace' | 'merge' | 'skip';
  validateIntegrity: boolean;
  dryRun: boolean;
};

export type ImportResult = {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  warnings: string[];
};

export type IntegrityReport = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

export type RepairResult = {
  repaired: string[];
  failed: string[];
};

export interface MasterPasswordState {
  hasMasterPassword: boolean;
  requireMasterPassword: boolean;
  hint?: string;
  autoLockMinutes: number;
  lastUnlockAt?: string;
}

export type AutoExportFrequency = 'every_minute' | 'daily' | 'weekly' | 'monthly';

export interface AutoExportConfig {
  enabled: boolean;
  frequency: AutoExportFrequency;
  directory: string;
  format: ExportOptions['format'];
  archivePassword?: string;
}
