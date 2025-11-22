import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Form, 
  Input, 
  Button, 
  Select, 
  Space, 
  message,
  Typography,
  Row,
  Col,
  Radio
} from 'antd';
import { 
  CopyOutlined, 
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import MultiAccountManager from './MultiAccountManager';
import PasswordGenerator from './PasswordGenerator';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;
 

interface PasswordDetailModalProps {
  visible: boolean;
  password: any;
  groups: any[];
  onClose: () => void;
  onSave: (password: any) => void;
  onDelete: (id: number) => void;
  mode: 'view' | 'edit' | 'create';
}

const PasswordDetailModal: React.FC<PasswordDetailModalProps> = ({
  visible,
  password,
  groups,
  onClose,
  onSave,
  onDelete,
  mode
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [multiAccounts, setMultiAccounts] = useState('');
  const [passwordGeneratorVisible, setPasswordGeneratorVisible] = useState(false);
  const [passwordType, setPasswordType] = useState<'single' | 'multi'>('single');
  const [multiViewVisible, setMultiViewVisible] = useState(false);

  useEffect(() => {
    if (visible && password) {
      form.setFieldsValue({
        title: password.title || '',
        username: password.username || '',
        password: password.password || '',
        url: password.url || '',
        notes: password.notes || '',
        group_id: password.group_id || null
      });
      setMultiAccounts(password.multi_accounts ?? password.multiAccounts ?? '');
      setShowPassword(false);
      // 根据数据判断密码类型
      if ((password.multi_accounts ?? password.multiAccounts ?? '').trim()) {
        setPasswordType('multi');
      } else {
        setPasswordType('single');
      }
    }
  }, [visible, password, form]);

  useEffect(() => {
    if (visible && mode === 'create') {
      form.resetFields();
      setMultiAccounts('');
      setShowPassword(false);
      setPasswordType('single');
    }
  }, [visible, mode, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 根据密码类型处理数据
      const passwordData = {
        ...values,
      };

      if (passwordType === 'single') {
        (passwordData as any).password = values.password;
        (passwordData as any).multi_accounts = undefined;
      } else {
        (passwordData as any).password = undefined;
        (passwordData as any).multi_accounts = multiAccounts || undefined;
      }

      if (mode === 'create') {
        await onSave(passwordData);
      } else {
        await onSave({ ...passwordData, id: password.id });
      }

      message.success(mode === 'create' ? '创建成功' : '更新成功');
      onClose();
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${fieldName}已复制到剪贴板`);
    } catch (error) {
      message.error('复制失败');
    }
  };

  const handleGeneratePassword = (generatedPassword: string) => {
    form.setFieldsValue({ password: generatedPassword });
    setPasswordGeneratorVisible(false);
    message.success('密码已生成');
  };

  const handleDelete = () => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个密码吗？此操作不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        onDelete(password.id);
        onClose();
      }
    });
  };

  const isReadonly = mode === 'view';

  return (
    <>
      <Modal
        title={
          <Title level={4} style={{ margin: 0 }}>
            {mode === 'create' ? '创建密码' : mode === 'edit' ? '编辑密码' : '密码详情'}
          </Title>
        }
        open={visible}
        onCancel={onClose}
        width={800}
        footer={
          <Space>
            <Button onClick={onClose}>
              {isReadonly ? '关闭' : '取消'}
            </Button>
            {!isReadonly && (
              <Button type="primary" onClick={handleSave} loading={loading}>
                保存
              </Button>
            )}
            {mode === 'view' && (
              <Button 
                type="default" 
                icon={<EditOutlined />}
                onClick={() => {
                  // 切换到编辑模式
                  // 这里需要父组件处理模式切换
                }}
              >
                编辑
              </Button>
            )}
            {mode === 'view' && (
              <Button 
                danger 
                icon={<DeleteOutlined />}
                onClick={handleDelete}
              >
                删除
              </Button>
            )}
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          disabled={isReadonly}
        >
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    label="标题"
                    name="title"
                    rules={[{ required: true, message: '请输入标题' }]}
                  >
                    <Input placeholder="请输入密码标题" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: true, message: '请输入用户名' }]}
                  >
                    <Input 
                      placeholder="请输入用户名"
                      suffix={
                        !isReadonly && (
                          <Button
                            type="text"
                            icon={<CopyOutlined />}
                            onClick={() => {
                              const value = form.getFieldValue('username');
                              if (value) handleCopy(value, '用户名');
                            }}
                          />
                        )
                      }
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="密码类型">
                    <Radio.Group 
                      value={passwordType} 
                      onChange={(e) => setPasswordType(e.target.value)}
                      disabled={isReadonly}
                    >
                      <Radio value="single">单一密码</Radio>
                      <Radio value="multi">多账号密码</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>

              {passwordType === 'single' ? (
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item
                      label="密码"
                      name="password"
                      rules={[{ required: passwordType === 'single', message: '请输入密码' }]}
                    >
                      <Input.Password
                        placeholder="请输入密码"
                        visibilityToggle={{
                          visible: showPassword,
                          onVisibleChange: setShowPassword
                        }}
                        suffix={
                          !isReadonly && (
                            <Space>
                              <Button
                                type="text"
                                icon={<CopyOutlined />}
                                onClick={() => {
                                  const value = form.getFieldValue('password');
                                  if (value) handleCopy(value, '密码');
                                }}
                              />
                              <Button
                                type="text"
                                onClick={() => setPasswordGeneratorVisible(true)}
                              >
                                生成
                              </Button>
                            </Space>
                          )
                        }
                      />
                    </Form.Item>
                  </Col>
                </Row>
              ) : null}

              {passwordType === 'multi' ? (
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item label="多账号密码管理">
                      <MultiAccountManager
                        passwordId={password?.id}
                        initialData={multiAccounts}
                        onSave={(data) => setMultiAccounts(data)}
                        readonly={isReadonly}
                      />
                      {!isReadonly && (
                        <div style={{ textAlign: 'right', marginTop: 8 }}>
                          <Button type="link" onClick={() => setMultiViewVisible(true)}>放大查看</Button>
                        </div>
                      )}
                    </Form.Item>
                  </Col>
                </Row>
              ) : null}

              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    label="URL"
                    name="url"
                  >
                    <Input 
                      placeholder="请输入网址"
                      suffix={
                        !isReadonly && (
                          <Button
                            type="text"
                            icon={<CopyOutlined />}
                            onClick={() => {
                              const value = form.getFieldValue('url');
                              if (value) handleCopy(value, 'URL');
                            }}
                          />
                        )
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    label="分组"
                    name="group_id"
                  >
                    <Select 
                      placeholder="请选择分组" 
                      allowClear
                      showSearch
                      filterOption={(input, option) =>
                        (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                      }
                    >
                      {groups.map(group => (
                        <Option key={group.id} value={group.id}>
                          {group.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    label="备注"
                    name="notes"
                  >
                    <TextArea 
                      placeholder="请输入备注信息" 
                      rows={3}
                      maxLength={1000}
                      showCount
                    />
                  </Form.Item>
                </Col>
              </Row>
        </Form>
      </Modal>

      <PasswordGenerator
        visible={passwordGeneratorVisible}
        onClose={() => setPasswordGeneratorVisible(false)}
        onGenerate={handleGeneratePassword}
      />

      <Modal
        title="多账号内容"
        open={multiViewVisible}
        onCancel={() => setMultiViewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setMultiViewVisible(false)}>关闭</Button>,
          <Button key="copy" type="primary" onClick={() => handleCopy(multiAccounts, '多账号内容')}>复制</Button>
        ]}
        width={900}
      >
        <TextArea value={multiAccounts} rows={16} readOnly style={{ fontFamily: 'monospace' }} />
      </Modal>
    </>
  );
};

export default PasswordDetailModal;
