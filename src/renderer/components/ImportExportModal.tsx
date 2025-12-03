import React, { useState } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Space,
  Upload,
  message,
} from 'antd';
import {
  DownloadOutlined,
  UploadOutlined,
  FileTextOutlined,
  LockOutlined,
  InboxOutlined,
} from '@ant-design/icons';

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
  // 预览已取消
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [archivePwd, setArchivePwd] = useState('');
  

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
          type: values.format === 'json' ? 'application/json' : 'application/octet-stream'
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `passwords_backup_${new Date().toISOString().split('T')[0]}.${values.format === 'json' ? 'json' : 'zip'}`;
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
      const inferredFormat = uploadFile.name.toLowerCase().endsWith('.zip') ? 'encrypted_zip' : 'json';
      const fmt = (importForm.getFieldValue('format') as 'json' | 'encrypted_zip') || inferredFormat;
      const pwd = archivePwd;
      if (fmt === 'encrypted_zip' && (!pwd || String(pwd).length < 4)) {
        message.error('请输入至少4位备份包密码');
        return;
      }

      // 读取文件内容
      const arrayBuffer = await uploadFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const result = await window.electronAPI.importData(Array.from(uint8Array), {
        format: fmt,
        mergeStrategy: 'merge',
        validateIntegrity: false,
        dryRun: false,
        archivePassword: pwd
      });
      
      if (result.success) {
        message.success(`导入成功，共处理 ${result.data?.imported || 0} 条记录`);
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
    accept: '.json,.zip',
    maxCount: 1,
    beforeUpload: (file: File) => {
      setUploadFile(file);
      const name = file.name.toLowerCase();
      let fmt: 'json' | 'encrypted_zip' = 'json';
      if (name.endsWith('.zip')) fmt = 'encrypted_zip';
      else fmt = 'json';
      importForm.setFieldsValue({ format: fmt });
      return false; // 阻止自动上传
    },
    onRemove: () => {
      setUploadFile(null);
      importForm.setFieldsValue({ format: 'json' });
      setArchivePwd('');
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
        <Select value={mode} onChange={(v) => { setMode(v as any); setUploadFile(null); }} style={{ width: 160 }}>
          <Option value="export">导出数据</Option>
          <Option value="import">导入数据</Option>
        </Select>
      </div>

      {mode === 'export' ? (
        <Form
          form={exportForm}
          layout="vertical"
          initialValues={{
            format: 'json'
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
              <Option value="encrypted_zip">
                <Space>
                  <LockOutlined />
                  加密ZIP（仅包含备份JSON）
                </Space>
              </Option>
            </Select>
          </Form.Item>

          {/* 导出密码 */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.format !== cur.format}
          >
            {({ getFieldValue }) => ['encrypted_zip'].includes(getFieldValue('format')) ? (
              <Form.Item
                label="备份包密码"
                name="archivePassword"
                rules={[{ required: true, message: '请设置备份包密码' }, { min: 4, message: '至少4位' }]}
              >
                <Input.Password style={{ width: '100%' }} placeholder="请输入密码" />
              </Form.Item>
            ) : null}
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.format !== cur.format}
          >
            {({ getFieldValue }) => getFieldValue('format') === 'zip' ? null : null}
          </Form.Item>

          

          {/* 已取消密码强度过滤与压缩级别选项 */}
        </Form>
      ) : (
        <Form
          form={importForm}
          layout="vertical"
          initialValues={{
            format: 'json'
          }}
        >
          <Form.Item label="选择文件" required>
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 JSON 与加密ZIP（仅含 JSON，需密码）
              </p>
            </Dragger>
          </Form.Item>

          {/* 已选择文件提示取消 */}

          <Form.Item
            label="文件格式"
            name="format"
            tooltip="指定导入文件的格式"
          >
            <Select>
              <Option value="json">JSON格式</Option>
              <Option value="encrypted_zip">加密ZIP（需密码）</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="备份包密码"
            name="archivePassword"
            hidden={importForm.getFieldValue('format') !== 'encrypted_zip'}
            preserve
            rules={[
              {
                validator: async (_, value) => {
                  const fmt = importForm.getFieldValue('format');
                  if (fmt === 'encrypted_zip') {
                    if (!value || String(value).length < 4) {
                      return Promise.reject(new Error('请输入至少4位备份包密码'));
                    }
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input.Password style={{ width: '100%' }} placeholder="请输入密码" value={archivePwd} onChange={(e) => setArchivePwd(e.target.value)} />
          </Form.Item>

          {/* 导入选项取消，默认智能合并 */}
        </Form>
      )}
    </Modal>
  );
};

export default ImportExportModal;
