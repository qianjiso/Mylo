import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Button, 
  Input, 
  Space, 
  message, 
  Form,
  Tooltip,
  Popconfirm
} from 'antd';
import { 
  EditOutlined, 
  CopyOutlined, 
  EyeOutlined, 
  EyeInvisibleOutlined,
  SaveOutlined,
  CloseOutlined,
  DeleteOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface MultiAccountManagerProps {
  passwordId: number;
  initialData?: string;
  onSave?: (multiAccounts: string) => void;
  readonly?: boolean;
}

const MultiAccountManager: React.FC<MultiAccountManagerProps> = ({
  passwordId: _passwordId,
  initialData = '',
  onSave,
  readonly = false
}) => {
  const [multiAccounts, setMultiAccounts] = useState<string>(initialData);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>(initialData);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setMultiAccounts(initialData);
    setEditValue(initialData);
  }, [initialData]);

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(multiAccounts);
      message.success('已复制到剪贴板');
    } catch (error) {
      message.error('复制失败');
    }
  };

  const handleEdit = () => {
    setEditValue(multiAccounts);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editValue.trim()) {
      message.warning('多账号信息不能为空');
      return;
    }

    setLoading(true);
    try {
      // 这里应该调用API保存到数据库
      // await window.electronAPI.updatePassword(passwordId, { multi_accounts: editValue });
      
      setMultiAccounts(editValue);
      setIsEditing(false);
      setIsVisible(false);
      message.success('保存成功');
      
      if (onSave) {
        onSave(editValue);
      }
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(multiAccounts);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      // await window.electronAPI.updatePassword(passwordId, { multi_accounts: '' });
      setMultiAccounts('');
      setEditValue('');
      setIsEditing(false);
      setIsVisible(false);
      message.success('删除成功');
      
      if (onSave) {
        onSave('');
      }
    } catch (error) {
      message.error('删除失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibility = () => {
    if (!isEditing) {
      setIsVisible(!isVisible);
    }
  };

  if (!multiAccounts && !isEditing) {
    return (
      <Card 
        title={
          <Space>
            <Title level={5} style={{ margin: 0 }}>多账号密码管理</Title>
          </Space>
        }
        size="small"
        extra={
          !readonly && (
            <Button 
              type="primary" 
              icon={<EditOutlined />} 
              onClick={handleEdit}
              size="small"
            >
              添加多账号信息
            </Button>
          )
        }
      >
        <Text type="secondary">暂无多账号信息</Text>
      </Card>
    );
  }

  return (
    <Card 
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>多账号密码管理</Title>
          {multiAccounts && (
            <Tooltip title={isVisible ? '隐藏内容' : '显示内容'}>
              <Button 
                type="text" 
                icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={toggleVisibility}
                size="small"
              />
            </Tooltip>
          )}
        </Space>
      }
      size="small"
      extra={
        !readonly && (
          <Space>
            {multiAccounts && !isEditing && (
              <>
                <Tooltip title="复制全部">
                  <Button 
                    type="text" 
                    icon={<CopyOutlined />} 
                    onClick={handleCopyAll}
                    size="small"
                  />
                </Tooltip>
                <Button 
                  type="text" 
                  icon={<EditOutlined />} 
                  onClick={handleEdit}
                  size="small"
                />
                <Popconfirm
                  title="确定要删除多账号信息吗？"
                  onConfirm={handleDelete}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />} 
                    size="small"
                  />
                </Popconfirm>
              </>
            )}
            {isEditing && (
              <>
                <Button 
                  type="primary" 
                  icon={<SaveOutlined />} 
                  onClick={handleSave}
                  loading={loading}
                  size="small"
                >
                  保存
                </Button>
                <Button 
                  icon={<CloseOutlined />} 
                  onClick={handleCancel}
                  size="small"
                >
                  取消
                </Button>
              </>
            )}
          </Space>
        )
      }
    >
      {isEditing ? (
        <Form layout="vertical">
          <Form.Item label="多账号信息（自由文本格式）">
            <TextArea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={`请输入多账号信息，例如：

安装器URL: http://installer.example.com
MySQL服务器: 192.168.1.100:3306
MySQL用户名: admin
MySQL密码: mysql123
Redis服务器: 192.168.1.101:6379
Redis密码: redis123`}
              rows={8}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
          <Form.Item>
            <Text type="secondary">
              提示：支持自由文本格式，可以包含服务器地址、用户名、密码等信息
            </Text>
          </Form.Item>
        </Form>
      ) : (
        <div>
          {isVisible ? (
            <div>
              <Paragraph 
                code 
                style={{ 
                  whiteSpace: 'pre-wrap', 
                  fontFamily: 'monospace',
                  backgroundColor: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '6px',
                  margin: 0,
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {multiAccounts}
              </Paragraph>
            </div>
          ) : (
            <Text type="secondary">内容已隐藏</Text>
          )}
        </div>
      )}
    </Card>
  );
};

export default MultiAccountManager;
