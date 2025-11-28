import React, { useState } from 'react';
import { Modal, Form, InputNumber, Switch, Button, Input, message } from 'antd';

interface PasswordGeneratorProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (password: string) => void;
}

const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({
  visible,
  onClose,
  onGenerate
}) => {
  const [form] = Form.useForm();
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const generatePassword = async (values: {
    length?: number;
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
  }) => {
    setLoading(true);
    try {
      const password = await window.electronAPI.generatePassword(values);
      setGeneratedPassword(password);
      message.success('密码生成成功');
    } catch (error) {
      message.error('密码生成失败');
      console.error('Generate password error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUsePassword = () => {
    if (generatedPassword) {
      onGenerate(generatedPassword);
      setGeneratedPassword('');
      form.resetFields();
      onClose();
    }
  };

  return (
    <Modal
      title="密码生成器"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="generate"
          type="primary"
          loading={loading}
          onClick={() => form.submit()}
        >
          生成密码
        </Button>,
        <Button
          key="use"
          type="primary"
          disabled={!generatedPassword}
          onClick={handleUsePassword}
        >
          使用此密码
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={generatePassword}
        initialValues={{
          length: 16,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true
        }}
      >
        <Form.Item
          name="length"
          label="密码长度"
          rules={[{ required: true, message: '请输入密码长度' }]}
        >
          <InputNumber min={4} max={128} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="includeUppercase"
          label="包含大写字母"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="includeLowercase"
          label="包含小写字母"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="includeNumbers"
          label="包含数字"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="includeSymbols"
          label="包含特殊字符"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        {generatedPassword && (
          <Form.Item label="生成的密码">
            <Input.Password
              value={generatedPassword}
              readOnly
              style={{ fontFamily: 'monospace' }}
              visibilityToggle={{ visible: true }}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default PasswordGenerator;
