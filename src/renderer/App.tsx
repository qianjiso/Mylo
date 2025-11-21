import React, { useState, useEffect } from 'react';
import { Layout, Button, Table, Modal, Form, Input, message, Space, Popconfirm, Tree, Select, Tabs, Tag, Typography, Tooltip } from 'antd';
import { formatTimestamp } from './utils/time';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, SettingOutlined, FolderOutlined, HistoryOutlined, FolderAddOutlined, EyeOutlined, EyeInvisibleOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import PasswordGenerator from './components/PasswordGenerator';
import PasswordDetailModal from './components/PasswordDetailModal';
import UserSettings from './components/UserSettings';
import ImportExportModal from './components/ImportExportModal';
import './styles/global.css';

// 从preload导入类型
import type { Group, GroupWithChildren, PasswordHistory } from '../main/preload';

// 在浏览器环境中导入mock
if (typeof window !== 'undefined' && !window.electronAPI) {
  import('./electronAPI-mock');
}

const { Header, Content, Sider } = Layout;
const { TabPane } = Tabs;
const { Option } = Select;
const { Title } = Typography;

const groupColorMap: Record<string, string> = {
  blue: '#1677ff',
  green: '#52c41a',
  red: '#f5222d',
  yellow: '#fadb14',
  purple: '#722ed1',
  orange: '#fa8c16',
  pink: '#eb2f96',
  gray: '#8c8c8c',
  cyan: '#13c2c2',
  teal: '#08979c',
  magenta: '#eb2f96',
  geekblue: '#2f54eb'
};

const getGroupColor = (color?: string) => {
  if (!color) return '#1677ff';
  return groupColorMap[color] || color;
};

interface Password {
  id: number;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  group_id?: number;
  multi_accounts?: string;
  created_at?: string;
  updated_at?: string;
}

const App: React.FC = () => {
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupTree, setGroupTree] = useState<GroupWithChildren[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();
  const [passwordHistory, setPasswordHistory] = useState<PasswordHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [importExportVisible, setImportExportVisible] = useState(false);
  const [editingPassword, setEditingPassword] = useState<Password | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [generatorVisible, setGeneratorVisible] = useState(false);
  const [passwordDetailMode, setPasswordDetailMode] = useState<'view' | 'edit' | 'create'>('view');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [visibleHistoryPasswords, setVisibleHistoryPasswords] = useState<Set<string>>(new Set());
  const [form] = Form.useForm();
  const [treeKey, setTreeKey] = useState(0);
  const [groupForm] = Form.useForm();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadGroups();
    loadRecentPasswords();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      loadPasswords(selectedGroupId);
      setSearchQuery('');
    } else if (!searchQuery) {
      loadRecentPasswords();
    }
  }, [selectedGroupId]);

  const loadPasswords = async (groupId?: number) => {
    setLoading(true);
    try {
      if (!window.electronAPI) {
        console.error('electronAPI is not available');
        return;
      }
      const result = await window.electronAPI.getPasswords(groupId);
      const formatted: Password[] = (result || []).map((item: any) => ({
        ...item,
        created_at:  item.created_at,
        updated_at:  item.updated_at,
        multi_accounts: item.multiAccounts || item.multi_accounts,
      }));
      setPasswords(formatted);
    } catch (error) {
      message.error('加载密码失败');
      console.error('Load passwords error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      if (!window.electronAPI) {
        console.error('electronAPI is not available');
        return;
      }
      const result = await window.electronAPI.getGroups();
      setGroups(result);
      
      const treeResult = await window.electronAPI.getGroupTree();
      setGroupTree(treeResult);
    } catch (error) {
      message.error('加载分组失败');
      console.error('Load groups error:', error);
    }
  };

  const loadRecentPasswords = async () => {
    setLoading(true);
    try {
      if (!window.electronAPI) return;
      const result = await window.electronAPI.getPasswords();
      const formatted: Password[] = (result || []).map((item: any) => ({
        ...item,
        created_at: item.created_at,
        updated_at: item.updated_at,
        multi_accounts: item.multiAccounts || item.multi_accounts,
      }));
      setPasswords(formatted);
    } catch (error) {
      console.error('Load recent passwords error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPasswordHistory = async (passwordId: number) => {
    try {
      const result = await window.electronAPI.getPasswordHistory(passwordId);
      setPasswordHistory(result);
    } catch (error) {
      message.error('加载密码历史失败');
      console.error('Load password history error:', error);
    }
  };

  const handleAdd = () => {
    setEditingPassword(selectedGroupId ? ({ group_id: selectedGroupId } as any) : null);
    setPasswordDetailMode('create');
    setModalVisible(true);
    form.resetFields();
  };

  const handleEdit = (record: Password) => {
    setEditingPassword(record);
    setPasswordDetailMode('edit');
    setModalVisible(true);
    form.setFieldsValue(record);
  };

  const handleView = (record: Password) => {
    setEditingPassword(record);
    setPasswordDetailMode('view');
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await window.electronAPI.deletePassword(id);
      if (result.success) {
        message.success('删除成功');
        loadPasswords(selectedGroupId);
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      message.error('删除失败');
      console.error('Delete password error:', error);
    }
  };

  const handleViewHistory = async (record: Password) => {
    if (record.id) {
      await loadPasswordHistory(record.id);
      setHistoryModalVisible(true);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingPassword && passwordDetailMode !== 'create') {
        const result = await window.electronAPI.updatePassword(editingPassword.id, values);
        if (result.success) {
          message.success('更新成功');
        } else {
          message.error((result as any).error || '更新失败');
        }
      } else {
        const result = await window.electronAPI.addPassword(values);
        if (result.success) {
          message.success('添加成功');
        } else {
          message.error((result as any).error || '添加失败');
        }
      }
      setModalVisible(false);
      loadPasswords(selectedGroupId);
    } catch (error) {
      message.error(passwordDetailMode === 'create' ? '添加失败' : '更新失败');
      console.error('Submit error:', error);
    }
  };

  const handleAddGroup = () => {
    setEditingGroup(null);
    setGroupModalVisible(true);
    groupForm.resetFields();
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setGroupModalVisible(true);
    groupForm.setFieldsValue(group);
  };

  const handleDeleteGroup = async (id: number) => {
    try {
      const result = await window.electronAPI.deleteGroup(id);
      if (result.success) {
        message.success('删除分组成功');
        loadGroups();
        if (selectedGroupId === id) {
          setSelectedGroupId(undefined);
        }
      } else {
        message.error('删除分组失败');
      }
    } catch (error) {
      message.error('删除分组失败');
      console.error('Delete group error:', error);
    }
  };

  

  const handleSubmitGroup = async (values: any) => {
    try {
      if (editingGroup && editingGroup.id) {
        const result = await window.electronAPI.updateGroup(editingGroup.id, values);
        if (result.success) {
          message.success('更新分组成功');
        } else {
          message.error((result as any).error || '更新分组失败');
        }
      } else {
        const result = await window.electronAPI.addGroup(values);
        if (result.success) {
          message.success('添加分组成功');
        } else {
          message.error((result as any).error || '添加分组失败');
        }
      }
      setGroupModalVisible(false);
      await loadGroups();
      // 强制刷新Tree组件
      setTreeKey(prev => prev + 1);
    } catch (error: any) {
      message.error(error.message || (editingGroup ? '更新分组失败' : '添加分组失败'));
      console.error('Submit group error:', error);
    }
  };

  const handleGeneratePassword = (password: string) => {
    form.setFieldsValue({ password });
    setGeneratorVisible(false);
    message.success('密码已生成');
  };

  const togglePasswordVisibility = (passwordId: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(passwordId)) {
        newSet.delete(passwordId);
      } else {
        newSet.add(passwordId);
      }
      return newSet;
    });
  };

  const toggleHistoryPasswordVisibility = (historyId: string) => {
    setVisibleHistoryPasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(historyId)) {
        newSet.delete(historyId);
      } else {
        newSet.add(historyId);
      }
      return newSet;
    });
  };

  const renderGroupTitle = (group: Group) => (
    <div className="group-tree-node">
      <div className="group-tree-node__info">
        <span className="group-color-dot" style={{ backgroundColor: getGroupColor(group.color) }} />
        <span className="group-tree-node__name">{group.name}</span>
      </div>
      <div className="group-tree-node__actions">
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleEditGroup(group);
          }}
        />
        {group.id && (
          <Popconfirm
            title="确定要删除这个分组吗？"
            onConfirm={(e) => {
              e?.stopPropagation();
              handleDeleteGroup(group.id!);
            }}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        )}
      </div>
    </div>
  );

  const buildGroupNodes = (groups: GroupWithChildren[]): DataNode[] =>
    groups.map(group => ({
      key: group.id?.toString() || `temp-${group.name}`,
      title: renderGroupTitle(group),
      children: group.children && group.children.length > 0 ? buildGroupNodes(group.children) : undefined,
    }));

  const treeData: DataNode[] = buildGroupNodes(groupTree);

  const handleGroupSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0) {
      const selectedKey = selectedKeys[0] as string;
      setSelectedGroupId(parseInt(selectedKey));
      const hasChildren = info.node && info.node.children && info.node.children.length > 0;
      if (hasChildren && !expandedKeys.includes(selectedKey)) {
        setExpandedKeys(prev => [...prev, selectedKey]);
      }
    } else {
      setSelectedGroupId(undefined);
    }
  };

  const columns: ColumnsType<Password> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      render: (text: string, record: Password) => {
        const isVisible = visiblePasswords.has(record.id.toString());
        return (
          <Space>
            <span style={{ fontFamily: isVisible ? 'monospace' : 'inherit' }}>
              {isVisible ? text : '••••••••'}
            </span>
            <Button
              type="link"
              size="small"
              icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => togglePasswordVisibility(record.id.toString())}
            />
          </Space>
        );
      },
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      render: (text: string) => text ? <a href={text} target="_blank" rel="noopener noreferrer">{text}</a> : '-',
    },
    {
      title: '分组',
      dataIndex: 'group_id',
      key: 'group_id',
      render: (groupId: number) => {
        const group = groups.find(g => g.id === groupId);
        return group ? (
          <Tag color={group.color}>
            {group.icon === 'folder' ? <FolderOutlined /> : null}
            {group.name}
          </Tag>
        ) : '-';
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => formatTimestamp(text),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="查看">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)} />
          </Tooltip>
          <Tooltip title="历史">
            <Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => handleViewHistory(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm title="确定要删除这个密码吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const historyColumns: ColumnsType<PasswordHistory> = [
    {
      title: '旧密码',
      dataIndex: 'old_password',
      key: 'old_password',
      render: (text: string, record: PasswordHistory) => {
        const isVisible = visibleHistoryPasswords.has(`old-${record.id}`);
        return (
          <Space>
            <span style={{ fontFamily: isVisible ? 'monospace' : 'inherit' }}>
              {isVisible ? text : '••••••••'}
            </span>
            <Button
              type="link"
              size="small"
              icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => toggleHistoryPasswordVisibility(`old-${record.id}`)}
            />
          </Space>
        );
      },
    },
    {
      title: '新密码',
      dataIndex: 'new_password',
      key: 'new_password',
      render: (text: string, record: PasswordHistory) => {
        const isVisible = visibleHistoryPasswords.has(`new-${record.id}`);
        return (
          <Space>
            <span style={{ fontFamily: isVisible ? 'monospace' : 'inherit' }}>
              {isVisible ? text : '••••••••'}
            </span>
            <Button
              type="link"
              size="small"
              icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => toggleHistoryPasswordVisibility(`new-${record.id}`)}
            />
          </Space>
        );
      },
    },
    {
      title: '更改时间',
      dataIndex: 'changed_at',
      key: 'changed_at',
      render: (text: string) => formatTimestamp(text),
    },
    {
      title: '更改原因',
      dataIndex: 'changed_reason',
      key: 'changed_reason',
      render: (text: string) => text || '-',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="header">
        <div className="logo">
          <KeyOutlined /> 密码管理器
        </div>
        <div className="header-actions">
          <Button
            icon={<DownloadOutlined />}
            onClick={() => setImportExportVisible(true)}
          >
            导入导出
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setSettingsVisible(true)}
          >
            设置
          </Button>
        </div>
      </Header>
      
      <Layout>
        <Sider width={250} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: '16px' }}>
            <Button
              icon={<FolderAddOutlined />}
              onClick={handleAddGroup}
              style={{ width: '100%', marginBottom: '16px' }}
            >
              新建分组
            </Button>
            
            <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#666' }}>
              分组列表
            </div>
            
            <Tree
              key={treeKey}
              showLine
              treeData={treeData}
              onSelect={handleGroupSelect}
              selectedKeys={selectedGroupId ? [selectedGroupId.toString()] : []}
              style={{ background: 'transparent' }}
              defaultExpandAll={true}
              expandAction="click"
              expandedKeys={expandedKeys}
              onExpand={(keys) => setExpandedKeys(keys as string[])}
            />
          </div>
        </Sider>
        
        <Layout style={{ padding: '24px' }}>
          <Content style={{ background: '#fff', padding: '24px', borderRadius: '8px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, whiteSpace: 'nowrap' }}>
                {searchQuery
                  ? '搜索结果'
                  : selectedGroupId
                    ? groups.find(g => g.id === selectedGroupId)?.name
                    : '最新记录'}
              </h2>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                添加密码
              </Button>
            </div>

            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <Input.Search
                allowClear
                placeholder="搜索标题、用户名、URL"
                onSearch={async (value) => {
                  setSearchQuery(value);
                  if (!value) {
                    setSelectedGroupId(undefined);
                    await loadRecentPasswords();
                    return;
                  }
                  try {
                    const result = await window.electronAPI.searchPasswords(value);
                    const formatted: Password[] = (result || []).map((item: any) => ({
                      ...item,
                      created_at: item.created_at,
                      updated_at: item.updated_at,
                      multi_accounts: item.multiAccounts || item.multi_accounts,
                    }));
                    setSelectedGroupId(undefined);
                    setPasswords(formatted);
                  } catch (error) {
                    message.error('搜索失败');
                  }
                }}
                style={{ maxWidth: 360 }}
              />
            </div>
            
            <Table
              columns={columns}
              dataSource={passwords}
              rowKey="id"
              loading={loading}
              pagination={{
                total: passwords.length,
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          </Content>
        </Layout>
      </Layout>

      <PasswordDetailModal
        visible={modalVisible}
        password={editingPassword}
        groups={groups}
        mode={passwordDetailMode}
        onClose={() => setModalVisible(false)}
        onSave={handleSubmit}
        onDelete={handleDelete}
      />

      <Modal
        title={editingGroup ? '编辑分组' : '新建分组'}
        open={groupModalVisible}
        onCancel={() => setGroupModalVisible(false)}
        footer={null}
      >
        <Form
          form={groupForm}
          layout="vertical"
          onFinish={handleSubmitGroup}
        >
          <Form.Item
            name="name"
            label="分组名称"
            rules={[{ required: true, message: '请输入分组名称' }]}
          >
            <Input placeholder="分组名称" />
          </Form.Item>
          
          <Form.Item
            name="parent_id"
            label="父级分组"
          >
            <Select placeholder="选择父级分组" allowClear>
              {groups.filter(g => !editingGroup || g.id !== editingGroup.id).map(group => (
                <Option key={group.id} value={group.id}>
                  {group.icon === 'folder' ? <FolderOutlined /> : null} {group.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="color"
            label="颜色"
            initialValue="blue"
          >
            <Select>
              <Option value="blue">蓝色</Option>
              <Option value="green">绿色</Option>
              <Option value="red">红色</Option>
              <Option value="orange">橙色</Option>
              <Option value="purple">紫色</Option>
              <Option value="cyan">青色</Option>
              <Option value="magenta">洋红色</Option>
              <Option value="yellow">黄色</Option>
              <Option value="pink">粉色</Option>
              <Option value="geekblue">极客蓝</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="sort"
            label="排序"
            tooltip="数字越小越靠前"
          >
            <Input type="number" placeholder="请输入排序数字" />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingGroup ? '更新' : '添加'}
              </Button>
              <Button onClick={() => setGroupModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="密码历史"
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHistoryModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <Table
          columns={historyColumns}
          dataSource={passwordHistory}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: '暂无历史记录' }}
        />
      </Modal>

      <PasswordGenerator
        visible={generatorVisible}
        onClose={() => setGeneratorVisible(false)}
        onGenerate={handleGeneratePassword}
      />

      <Modal
        title="用户设置"
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={null}
        width={1000}
        destroyOnHidden
      >
        <UserSettings onClose={() => setSettingsVisible(false)} />
      </Modal>

      <ImportExportModal
        visible={importExportVisible}
        onClose={() => setImportExportVisible(false)}
      />
    </Layout>
  );
};

export default App;
