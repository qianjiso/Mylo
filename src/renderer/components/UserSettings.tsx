import React, { useState, useEffect } from 'react';
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
  InputNumber
} from 'antd';
import { SaveOutlined, ReloadOutlined, SafetyCertificateOutlined, ToolOutlined, CloudDownloadOutlined, CloudUploadOutlined, CheckCircleOutlined, ToolTwoTone } from '@ant-design/icons';
import type { UserSetting } from '../../shared/types';
import * as settingsService from '../services/settings';
import ImportExportModal from './ImportExportModal';
import { useBackup } from '../hooks/useBackup';
import { useIntegrity } from '../hooks/useIntegrity';

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
  

useEffect(() => {
  const load = async () => {
    try {
      setLoading(true);
      const settingsData = await settingsService.listSettings();
      const formData: Record<string, any> = {};
      settingsData.forEach((setting: UserSetting) => {
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
      
      // 保存每个设置项
      for (const [key, value] of Object.entries(values)) {
        await settingsService.setSetting(key, String(value));
      }
      
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
      const settingsData = await settingsService.listSettings();
      const formData: Record<string, any> = {};
      settingsData.forEach((setting: UserSetting) => {
        if (setting.type === 'boolean') formData[setting.key] = setting.value === 'true';
        else if (setting.type === 'number') formData[setting.key] = Number(setting.value);
        else formData[setting.key] = setting.value;
      });
      form.setFieldsValue(formData);
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
                name="autoLockTime"
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
      <ImportExportModal visible={exportModalVisible} onClose={() => setExportModalVisible(false)} />
    </div>
  );
};

export default UserSettings;
