import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Form, 
  Switch, 
  Select, 
  Button, 
  Space, 
  message,
  Divider,
  Typography,
  Row,
  Col,
  InputNumber,
  Tag,
  Modal,
  Alert,
  Input
} from 'antd';
import { SaveOutlined, ReloadOutlined, SafetyCertificateOutlined, ToolOutlined, CloudDownloadOutlined, CloudUploadOutlined, CheckCircleOutlined, ToolTwoTone } from '@ant-design/icons';
import type { MasterPasswordState, UserSetting } from '../../shared/types';
import * as settingsService from '../services/settings';
import ImportExportModal from './ImportExportModal';
import { useBackup } from '../hooks/useBackup';
import { useIntegrity } from '../hooks/useIntegrity';
import * as securityService from '../services/security';

const { Title } = Typography;
const { Option } = Select;

interface UserSettingsProps {
  onClose?: () => void;
}

const UserSettings: React.FC<UserSettingsProps> = ({ onClose }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const { exporting, exportData } = useBackup();
  const { checking, repairing, report, repairResult, check, repair } = useIntegrity();
  const [securityState, setSecurityState] = useState<MasterPasswordState | null>(null);
  const [masterModalVisible, setMasterModalVisible] = useState(false);
  const [masterMode, setMasterMode] = useState<'set' | 'update' | 'remove'>('set');
  const [masterSaving, setMasterSaving] = useState(false);
  const [masterForm] = Form.useForm();

  const loadSecurityState = useCallback(async () => {
    const state = await securityService.getSecurityState();
    setSecurityState(state);
    form.setFieldsValue({
      requireMasterPassword: state.requireMasterPassword,
      autoLockMinutes: state.autoLockMinutes
    });
  }, [form]);

useEffect(() => {
  const load = async () => {
    try {
      setLoading(true);
      const settingsData = await settingsService.listSettings();
      const formData: Record<string, any> = {};
      const secState = await securityService.getSecurityState();
      setSecurityState(secState);
      formData.requireMasterPassword = secState.requireMasterPassword;
      formData.autoLockMinutes = secState.autoLockMinutes;
      settingsData.forEach((setting: UserSetting) => {
        if (setting.key === 'security.auto_lock_timeout') {
          const minutes = Math.max(1, Math.round(Number(setting.value) / 60));
          formData.autoLockMinutes = minutes;
          return;
        }
        if (setting.key === 'autoLockTime') {
          formData.autoLockMinutes = Number(setting.value) || formData.autoLockMinutes;
          return;
        }
        if (setting.type === 'boolean') {
          formData[setting.key] = setting.value === 'true';
        } else if (setting.type === 'number') {
          formData[setting.key] = Number(setting.value);
        } else {
          formData[setting.key] = setting.value;
        }
      });
      form.setFieldsValue(formData);
    } catch (error) {
      console.error('加载设置失败:', error);
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };
  load();
}, [form]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = form.getFieldsValue();
      
      if (values.autoLockMinutes != null) {
        const seconds = Math.max(1, Number(values.autoLockMinutes)) * 60;
        await settingsService.setSetting('security.auto_lock_timeout', String(seconds), 'number', 'security', '自动锁定时间（秒）');
      }
      if (typeof values.requireMasterPassword === 'boolean') {
        await securityService.setRequireMasterPassword(values.requireMasterPassword);
      }

      // 保存其他设置项
      for (const [key, value] of Object.entries(values)) {
        if (key === 'autoLockMinutes' || key === 'requireMasterPassword') continue;
        await settingsService.setSetting(key, String(value));
      }
      await loadSecurityState();
      message.success('设置保存成功');
      if (onClose) onClose();
    } catch (error) {
      console.error('保存设置失败:', error);
      message.error('保存设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      const res = await settingsService.resetAllSettingsToDefault();
      if (!res.success) throw new Error(res.error || '重置失败');
      await securityService.setRequireMasterPassword(false);
      const settingsData = await settingsService.listSettings();
      const formData: Record<string, any> = {};
      settingsData.forEach((setting: UserSetting) => {
        if (setting.key === 'security.auto_lock_timeout') {
          formData.autoLockMinutes = Math.max(1, Math.round(Number(setting.value) / 60));
          return;
        }
        if (setting.type === 'boolean') formData[setting.key] = setting.value === 'true';
        else if (setting.type === 'number') formData[setting.key] = Number(setting.value);
        else formData[setting.key] = setting.value;
      });
      form.setFieldsValue({
        requireMasterPassword: false,
        autoLockMinutes: formData.autoLockMinutes || 5,
        ...formData
      });
      await loadSecurityState();
      message.success('已重置为默认设置');
    } catch (error) {
      console.error('重置设置失败:', error);
      message.error('重置设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickExport = async () => {
    try {
      const data = await exportData({ format: 'json' });
      const blob = new Blob([data as unknown as BlobPart], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `passwords_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success('已导出 JSON 备份');
    } catch (error) {
      console.error('快速导出失败:', error);
      message.error('快速导出失败');
    }
  };

  const handleCheckIntegrity = async () => {
    try {
      const r = await check();
      const errCount = r.errors.length;
      const warnCount = r.warnings.length;
      message.success(`完整性检查完成，错误 ${errCount}，警告 ${warnCount}`);
    } catch (error) {
      console.error('完整性检查失败:', error);
      message.error('完整性检查失败');
    }
  };

  const handleRepairIntegrity = async () => {
    try {
      const r = await repair();
      message.success(`修复完成：${r.repaired.length} 条修复，${r.failed.length} 条失败`);
    } catch (error) {
      console.error('完整性修复失败:', error);
      message.error('完整性修复失败');
    }
  };

  const handleMasterSubmit = async () => {
    const values = await masterForm.validateFields();
    try {
      setMasterSaving(true);
      let res: { success: boolean; error?: string; state?: MasterPasswordState } = { success: false };
      if (masterMode === 'remove') {
        res = await securityService.clearMasterPassword(values.currentPassword);
      } else if (masterMode === 'update') {
        res = await securityService.updateMasterPassword(values.currentPassword, values.newPassword, values.hint);
      } else {
        res = await securityService.setMasterPassword(values.newPassword, values.hint);
      }
      if (!res.success) throw new Error(res.error || '操作失败');
      setSecurityState(res.state || null);
      form.setFieldsValue({
        requireMasterPassword: res.state?.requireMasterPassword ?? form.getFieldValue('requireMasterPassword'),
        autoLockMinutes: res.state?.autoLockMinutes ?? form.getFieldValue('autoLockMinutes')
      });
      setMasterModalVisible(false);
      masterForm.resetFields();
      message.success(masterMode === 'remove' ? '已关闭主密码' : '主密码已更新');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '操作失败';
      console.error('主密码操作失败:', error);
      message.error(msg);
      throw error;
    } finally {
      setMasterSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={3}>用户设置</Title>
      
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: '24px' }}
      >
        {/* 安全设置 */}
        <Card title="安全设置" style={{ marginBottom: '16px' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="自动锁定时间（分钟）"
                name="autoLockMinutes"
                tooltip="应用闲置多长时间后自动锁定"
              >
                <InputNumber
                  min={1}
                  max={120}
                  style={{ width: '100%' }}
                  placeholder="5"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="要求主密码"
                name="requireMasterPassword"
                tooltip="是否需要主密码才能访问应用"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Divider>主密码</Divider>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space size="small">
              <Tag color={securityState?.hasMasterPassword ? 'green' : 'red'}>
                {securityState?.hasMasterPassword ? '已设置' : '未设置'}
              </Tag>
              <Typography.Text type="secondary">
                {securityState?.hasMasterPassword ? '已启用主密码访问控制' : '建议设置主密码以保护数据'}
              </Typography.Text>
            </Space>
            <Space wrap>
              <Button
                type="primary"
                onClick={() => { setMasterMode(securityState?.hasMasterPassword ? 'update' : 'set'); masterForm.resetFields(); setMasterModalVisible(true); }}
              >
                {securityState?.hasMasterPassword ? '修改主密码' : '设置主密码'}
              </Button>
              {securityState?.hasMasterPassword && (
                <Button danger onClick={() => { setMasterMode('remove'); masterForm.resetFields(); setMasterModalVisible(true); }}>
                  关闭主密码
                </Button>
              )}
            </Space>
          </Space>

          <Divider>密码生成器设置</Divider>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="默认密码长度"
                name="security.password_generator_length"
              >
                <InputNumber
                  min={4}
                  max={64}
                  style={{ width: '100%' }}
                  placeholder="16"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="包含大写字母"
                name="security.password_generator_include_uppercase"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="包含小写字母"
                name="security.password_generator_include_lowercase"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="包含数字"
                name="security.password_generator_include_numbers"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="包含特殊字符"
                name="security.password_generator_include_symbols"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* UI设置 */}
        <Card title="界面设置" style={{ marginBottom: '16px' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="主题"
                name="theme"
              >
                <Select placeholder="选择主题">
                  <Option value="light">浅色主题</Option>
                  <Option value="dark">深色主题</Option>
                  <Option value="auto">跟随系统</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="语言"
                name="language"
              >
                <Select placeholder="选择语言">
                  <Option value="zh-CN">简体中文</Option>
                  <Option value="en-US">English</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="显示密码强度"
                name="showPasswordStrength"
                valuePropName="checked"
                tooltip="在密码输入框下方显示密码强度指示器"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="自动保存"
                name="autoSave"
                valuePropName="checked"
                tooltip="编辑时自动保存密码"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 数据管理设置 */}
        <Card title="数据管理" style={{ marginBottom: '16px' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="默认导出格式"
                name="exportFormat"
              >
                <Select placeholder="选择导出格式">
                  <Option value="json">JSON</Option>
                  <Option value="csv">CSV</Option>
                  <Option value="txt">TXT</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="启用自动备份"
                name="backupEnabled"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="剪贴板清除时间（秒）"
                name="clipboardClearTime"
                tooltip="复制密码到剪贴板后，多长时间自动清除"
              >
                <InputNumber
                  min={5}
                  max={300}
                  style={{ width: '100%' }}
                  placeholder="30"
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 备份与完整性 */}
        <Card title="备份与完整性" style={{ marginBottom: '16px' }}>
          <Space wrap>
            <Button icon={<CloudDownloadOutlined />} onClick={handleQuickExport} loading={exporting}>
              快速导出（JSON）
            </Button>
            <Button icon={<CloudUploadOutlined />} onClick={() => setExportModalVisible(true)}>
              打开导入/导出窗口
            </Button>
            <Button icon={<SafetyCertificateOutlined />} onClick={handleCheckIntegrity} loading={checking}>
              检查数据完整性
            </Button>
            <Button icon={<ToolOutlined />} onClick={handleRepairIntegrity} loading={repairing}>
              修复数据完整性
            </Button>
          </Space>

          <Divider />
          <Row gutter={16}>
            <Col span={12}>
              <Title level={5}>
                <CheckCircleOutlined /> 检查结果
              </Title>
              <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #f0f0f0', padding: 8 }}>
                {report ? (
                  <div>
                    <div>错误 {report.errors.length}，警告 {report.warnings.length}</div>
                    {report.errors.map((e, idx) => (
                      <div key={`err-${idx}`} style={{ color: '#cf1322' }}>{e}</div>
                    ))}
                    {report.warnings.map((w, idx) => (
                      <div key={`warn-${idx}`} style={{ color: '#faad14' }}>{w}</div>
                    ))}
                  </div>
                ) : (
                  <div>尚未执行检查</div>
                )}
              </div>
            </Col>
            <Col span={12}>
              <Title level={5}>
                <ToolTwoTone twoToneColor="#52c41a" /> 修复结果
              </Title>
              <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #f0f0f0', padding: 8 }}>
                {repairResult ? (
                  <div>
                    <div>已修复 {repairResult.repaired.length}，失败 {repairResult.failed.length}</div>
                    {repairResult.repaired.map((r, idx) => (
                      <div key={`rep-${idx}`} style={{ color: '#52c41a' }}>{r}</div>
                    ))}
                    {repairResult.failed.map((f, idx) => (
                      <div key={`fail-${idx}`} style={{ color: '#cf1322' }}>{f}</div>
                    ))}
                  </div>
                ) : (
                  <div>尚未执行修复</div>
                )}
              </div>
            </Col>
          </Row>
        </Card>

        {/* 操作按钮 */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Space size="large">
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={handleReset}
              loading={loading}
            >
              重置为默认
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
            >
              保存设置
            </Button>
          </Space>
        </div>
      </Form>
      <Modal
        title={masterMode === 'remove' ? '关闭主密码' : securityState?.hasMasterPassword ? '修改主密码' : '设置主密码'}
        open={masterModalVisible}
        onCancel={() => setMasterModalVisible(false)}
        onOk={async () => {
          try {
            await masterForm.validateFields();
            await handleMasterSubmit();
          } catch {
            /* no-op */
          }
        }}
        okButtonProps={{ loading: masterSaving }}
        destroyOnClose
      >
        <Form layout="vertical" form={masterForm}>
          {masterMode !== 'set' && (
            <Form.Item
              label="当前主密码"
              name="currentPassword"
              rules={[{ required: true, message: '请输入当前主密码' }]}
            >
              <Input.Password />
            </Form.Item>
          )}
          {masterMode !== 'remove' && (
            <>
              <Form.Item
                label="新主密码"
                name="newPassword"
                rules={[{ required: true, message: '请输入新主密码' }, { min: 6, message: '至少6位字符' }]}
              >
                <Input.Password placeholder="至少6位，建议包含字母和数字" />
              </Form.Item>
              <Form.Item
                label="确认新主密码"
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请再次输入新主密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的主密码不一致'));
                    }
                  })
                ]}
              >
                <Input.Password />
              </Form.Item>
              <Form.Item label="主密码提示（可选）" name="hint">
                <Input placeholder="仅自己能懂的提示" maxLength={100} />
              </Form.Item>
            </>
          )}
          {masterMode === 'remove' && (
            <Alert type="warning" message="关闭主密码后，应用启动将不再需要解锁，请确认已备份数据。" />
          )}
        </Form>
      </Modal>
      <ImportExportModal visible={exportModalVisible} onClose={() => setExportModalVisible(false)} />
    </div>
  );
};

export default UserSettings;
