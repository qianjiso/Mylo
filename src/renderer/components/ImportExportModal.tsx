import React, { useState } from 'react';
import {
  Modal,
  Form,
  Select,
  Switch,
  InputNumber,
  Button,
  Space,
  Typography,
  Divider,
  Upload,
  message,
  Radio,
  Alert,
} from 'antd';
import {
  DownloadOutlined,
  UploadOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  LockOutlined,
  InboxOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

interface ImportExportModalProps {
  visible: boolean;
  onClose: () => void;
}

 

const ImportExportModal: React.FC<ImportExportModalProps> = ({ visible, onClose }) => {
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [exportForm] = Form.useForm();
  const [importForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // 导出数据
  const handleExport = async () => {
    try {
      setLoading(true);
      const values = await exportForm.validateFields();
      
      const result = await window.electronAPI.exportData(values);
      
      if (result.success && result.data) {
        // 创建下载链接
        const uint8Array = new Uint8Array(result.data);
        const blob = new Blob([uint8Array], { 
          type: values.format === 'json' ? 'application/json' : 
                values.format === 'csv' ? 'text/csv' : 
                'application/zip' 
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `passwords_backup_${new Date().toISOString().split('T')[0]}.${values.format === 'csv' ? 'csv' : values.format === 'json' ? 'json' : 'zip'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        message.success('数据导出成功');
      } else {
        message.error(result.error || '导出失败');
      }
    } catch (error) {
      console.error('Export error:', error);
      message.error('导出过程中发生错误');
    } finally {
      setLoading(false);
    }
  };

  // 导入数据
  const handleImport = async () => {
    if (!uploadFile) {
      message.error('请选择要导入的文件');
      return;
    }

    try {
      setLoading(true);
      const values = await importForm.validateFields();
      
      // 读取文件内容
      const arrayBuffer = await uploadFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const result = await window.electronAPI.importData(Array.from(uint8Array), values);
      
      if (result.success) {
        setImportResult(result.data);
        if (values.dryRun) {
          message.info('预览完成，请查看导入预览结果');
        } else {
          message.success(`导入成功，共处理 ${result.data?.processed || 0} 条记录`);
        }
      } else {
        message.error(result.error || '导入失败');
      }
    } catch (error) {
      console.error('Import error:', error);
      message.error('导入过程中发生错误');
    } finally {
      setLoading(false);
    }
  };

  // 文件上传配置
  const uploadProps = {
    accept: '.json,.csv,.zip',
    maxCount: 1,
    beforeUpload: (file: File) => {
      setUploadFile(file);
      return false; // 阻止自动上传
    },
    onRemove: () => {
      setUploadFile(null);
    },
  };

  return (
    <Modal
      title={
        <Space>
          {mode === 'export' ? <DownloadOutlined /> : <UploadOutlined />}
          数据{mode === 'export' ? '导出' : '导入'}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="execute"
          type="primary"
          loading={loading}
          onClick={mode === 'export' ? handleExport : handleImport}
        >
          {mode === 'export' ? '导出' : '导入'}
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Radio.Group
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setImportResult(null);
            setUploadFile(null);
          }}
          buttonStyle="solid"
        >
          <Radio.Button value="export">导出数据</Radio.Button>
          <Radio.Button value="import">导入数据</Radio.Button>
        </Radio.Group>
      </div>

      {mode === 'export' ? (
        <Form
          form={exportForm}
          layout="vertical"
          initialValues={{
            format: 'json',
            includeHistory: true,
            includeGroups: true,
            includeSettings: true,
            passwordStrength: 'medium',
            compressionLevel: 6,
          }}
        >
          <Form.Item
            label="导出格式"
            name="format"
            tooltip="选择导出文件的格式"
          >
            <Select>
              <Option value="json">
                <Space>
                  <FileTextOutlined />
                  JSON格式（完整数据结构）
                </Space>
              </Option>
              <Option value="csv">
                <Space>
                  <FileExcelOutlined />
                  CSV格式（仅密码条目）
                </Space>
              </Option>
              <Option value="encrypted_zip">
                <Space>
                  <LockOutlined />
                  加密压缩包（AES-256加密）
                </Space>
              </Option>
            </Select>
          </Form.Item>

          <Divider>导出内容</Divider>

          <Form.Item
            label="包含密码历史记录"
            name="includeHistory"
            valuePropName="checked"
            tooltip="是否导出密码的修改历史记录"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="包含分组信息"
            name="includeGroups"
            valuePropName="checked"
            tooltip="是否导出分组结构和设置"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="包含用户设置"
            name="includeSettings"
            valuePropName="checked"
            tooltip="是否导出用户配置和偏好设置"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="密码强度过滤"
            name="passwordStrength"
            tooltip="只导出指定强度及以上的密码"
          >
            <Select>
              <Option value="weak">弱密码及以上</Option>
              <Option value="medium">中等强度及以上</Option>
              <Option value="strong">仅强密码</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="压缩级别"
            name="compressionLevel"
            tooltip="压缩级别，1最快但压缩率低，9最慢但压缩率高"
          >
            <InputNumber min={1} max={9} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      ) : (
        <Form
          form={importForm}
          layout="vertical"
          initialValues={{
            format: 'json',
            mergeStrategy: 'merge',
            validateIntegrity: true,
            dryRun: false,
          }}
        >
          <Form.Item label="选择文件" required>
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 JSON、CSV 和加密 ZIP 格式
              </p>
            </Dragger>
          </Form.Item>

          {uploadFile && (
            <Alert
              message={`已选择文件: ${uploadFile.name}`}
              type="info"
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            label="文件格式"
            name="format"
            tooltip="指定导入文件的格式"
          >
            <Select>
              <Option value="json">JSON格式</Option>
              <Option value="csv">CSV格式</Option>
            </Select>
          </Form.Item>

          <Divider>导入选项</Divider>

          <Form.Item
            label="合并策略"
            name="mergeStrategy"
            tooltip="如何处理与现有数据的冲突"
          >
            <Radio.Group>
              <Radio value="replace">替换现有数据</Radio>
              <Radio value="merge">智能合并</Radio>
              <Radio value="skip">跳过冲突项</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label="验证数据完整性"
            name="validateIntegrity"
            valuePropName="checked"
            tooltip="导入前验证数据完整性和格式正确性"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="预览模式"
            name="dryRun"
            valuePropName="checked"
            tooltip="仅预览导入结果，不实际导入数据"
          >
            <Switch />
          </Form.Item>

          {importResult && (
            <div style={{ marginTop: 16 }}>
              <Title level={5}>导入预览</Title>
              <Text>预计导入 {importResult.processed || 0} 条记录</Text>
              {importResult.warnings && importResult.warnings.length > 0 && (
                <Alert
                  message="警告"
                  description={importResult.warnings.join(', ')}
                  type="warning"
                  showIcon
                  style={{ marginTop: 8 }}
                />
              )}
              {importResult.errors && importResult.errors.length > 0 && (
                <Alert
                  message="错误"
                  description={importResult.errors.join(', ')}
                  type="error"
                  showIcon
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          )}
        </Form>
      )}
    </Modal>
  );
};

export default ImportExportModal;
