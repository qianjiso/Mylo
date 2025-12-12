// Mock electronAPI for browser development
const electronAPI = {
  // 密码管理相关
  getPasswords: (_groupId?: number) => Promise.resolve([]),
  getPassword: (_id: number) => Promise.resolve(null),
  addPassword: (_password: any) => Promise.resolve({ success: true, id: Date.now() }),
  updatePassword: (_id: number, _password: any) => Promise.resolve({ success: true }),
  deletePassword: (_id: number) => Promise.resolve({ success: true }),
  searchPasswords: (_keyword: string) => Promise.resolve([]),
  
  // 密码历史记录
  getPasswordHistory: (_passwordId: number) => Promise.resolve([]),
  getPasswordsNeedingUpdate: () => Promise.resolve([]),
  
  // 分组管理
  getGroups: () => Promise.resolve([]),
  getGroupTree: (_parentId?: number) => Promise.resolve([]),
  addGroup: (_group: any) => Promise.resolve({ success: true, id: Date.now() }),
  updateGroup: (_id: number, _group: any) => Promise.resolve({ success: true }),
  deleteGroup: (_id: number) => Promise.resolve({ success: true }),
  
  // 用户设置
  getUserSettings: (_category?: string) => Promise.resolve([]),
  getUserSetting: (_key: string) => Promise.resolve(null),
  setUserSetting: (_key: string, _value: string, _type?: string, _category?: string, _description?: string) => Promise.resolve({ success: true }),
  updateUserSetting: (_key: string, _value: string) => Promise.resolve({ success: true }),
  deleteUserSetting: (_key: string) => Promise.resolve({ success: true }),
  getUserSettingsCategories: () => Promise.resolve([]),
  
  // 密码生成
  generatePassword: (options: { 
    length?: number; 
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
  }) => {
    const length = options.length || 16;
    let charset = '';
    
    if (options.includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (options.includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (options.includeNumbers) charset += '0123456789';
    if (options.includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    if (!charset) charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return Promise.resolve(password);
  },
  
  // 系统相关
  getVersion: () => Promise.resolve('1.0.0'),
  quit: () => {},
  
  // 文件操作
  exportData: () => Promise.resolve({ success: true, data: '{}' }),
  importData: (_data: number[], _options?: any) => Promise.resolve({ success: true }),
  getSecurityState: () => Promise.resolve({
    hasMasterPassword: false,
    requireMasterPassword: false,
    hint: '',
    autoLockMinutes: 5,
    lastUnlockAt: ''
  }),
  setMasterPassword: (_password: string, _hint?: string) => Promise.resolve({ success: true }),
  verifyMasterPassword: (_password: string) => Promise.resolve({ success: true }),
  updateMasterPassword: (_currentPassword: string, _newPassword: string, _hint?: string) => Promise.resolve({ success: true }),
  clearMasterPassword: (_currentPassword: string) => Promise.resolve({ success: true }),
  setRequireMasterPassword: (_require: boolean) => Promise.resolve({ success: true })
};

// 在浏览器环境中，将electronAPI挂载到window对象上
if (typeof window !== 'undefined') {
  (window as any).electronAPI = electronAPI;
}

export default electronAPI;
