// Mock electronAPI for browser development
const electronAPI = {
  // 密码管理相关
  getPasswords: (groupId?: number) => Promise.resolve([]),
  getPassword: (id: number) => Promise.resolve(null),
  addPassword: (password: any) => Promise.resolve({ success: true, id: Date.now() }),
  updatePassword: (id: number, password: any) => Promise.resolve({ success: true }),
  deletePassword: (id: number) => Promise.resolve({ success: true }),
  searchPasswords: (keyword: string) => Promise.resolve([]),
  
  // 密码历史记录
  getPasswordHistory: (passwordId: number) => Promise.resolve([]),
  getPasswordsNeedingUpdate: () => Promise.resolve([]),
  
  // 分组管理
  getGroups: () => Promise.resolve([]),
  getGroupTree: (parentId?: number) => Promise.resolve([]),
  addGroup: (group: any) => Promise.resolve({ success: true, id: Date.now() }),
  updateGroup: (id: number, group: any) => Promise.resolve({ success: true }),
  deleteGroup: (id: number) => Promise.resolve({ success: true }),
  
  // 用户设置
  getUserSettings: (category?: string) => Promise.resolve([]),
  getUserSetting: (key: string) => Promise.resolve(null),
  setUserSetting: (key: string, value: string, type?: string, category?: string, description?: string) => Promise.resolve({ success: true }),
  updateUserSetting: (key: string, value: string) => Promise.resolve({ success: true }),
  deleteUserSetting: (key: string) => Promise.resolve({ success: true }),
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
  importData: (data: string) => Promise.resolve({ success: true })
};

// 在浏览器环境中，将electronAPI挂载到window对象上
if (typeof window !== 'undefined') {
  (window as any).electronAPI = electronAPI;
}

export default electronAPI;