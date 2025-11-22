import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Button, 
  Input, 
  Space, 
  message, 
  Form,
  Tooltip
} from 'antd';
import { 
  CopyOutlined, 
  EyeOutlined, 
  EyeInvisibleOutlined
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

  useEffect(() => {
    setMultiAccounts(initialData);
  }, [initialData]);

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(multiAccounts);
      message.success('已复制到剪贴板');
    } catch (error) {
      message.error('复制失败');
    }
  };

  const handleChange = (val: string) => {
    setMultiAccounts(val);
    if (onSave) onSave(val);
  };

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  if (!multiAccounts && readonly) {
    return (
      <Card 
        title={
          <Space>
            <Title level={5} style={{ margin: 0 }}>多账号密码管理</Title>
          </Space>
        }
        size="small"
      >
        <Text type="secondary">暂无多账号信息</Text>
      </Card>
    );
  }

  return (
    <Card 
      title={<Space><Title level={5} style={{ margin: 0 }}>多账号密码管理</Title></Space>}
      size="small"
      extra={multiAccounts && !readonly ? (
        <Tooltip title="复制全部">
          <Button type="text" icon={<CopyOutlined />} onClick={handleCopyAll} size="small" />
        </Tooltip>
      ) : undefined}
    >
      {readonly ? (
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
          {multiAccounts && (
            <Tooltip title={isVisible ? '隐藏内容' : '显示内容'}>
              <Button type="text" icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={toggleVisibility} size="small" />
            </Tooltip>
          )}
        </div>
      ) : (
        <Form layout="vertical">
          <Form.Item label="多账号信息（自由文本格式）">
            <TextArea
              value={multiAccounts}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={`请输入多账号信息，例如：
\n安装器URL: http://installer.example.com
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
            <Text type="secondary">提示：支持自由文本格式，可以包含服务器地址、用户名、密码等信息</Text>
          </Form.Item>
        </Form>
      )}
    </Card>
  );
};

export default MultiAccountManager;
