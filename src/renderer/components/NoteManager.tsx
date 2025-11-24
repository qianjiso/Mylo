import React, { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, Select, Space, Tag, message } from 'antd';

interface NoteGroup {
  id?: number;
  name: string;
  parent_id?: number | null;
  color?: string;
}

interface NoteRecord {
  id?: number;
  title?: string | null;
  content_ciphertext: string;
  group_id?: number | null;
  pinned?: boolean;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

const NoteManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [groups, setGroups] = useState<NoteGroup[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteRecord | null>(null);
  const [form] = Form.useForm();

  const loadGroups = async () => {
    try {
      const res = await window.electronAPI.getNoteGroups();
      setGroups(res || []);
    } catch (e) {
      message.error('加载分组失败');
    }
  };

  const loadNotes = async (groupId?: number) => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getNotes(groupId);
      setNotes(res || []);
    } catch (e) {
      message.error('加载便笺失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
    loadNotes();
  }, []);

  const handleAdd = () => {
    setEditingNote(null);
    form.resetFields();
    setEditVisible(true);
  };

  const handleEdit = (record: NoteRecord) => {
    setEditingNote(record);
    form.setFieldsValue({ title: record.title || '', content_ciphertext: record.content_ciphertext, group_id: record.group_id || undefined });
    setEditVisible(true);
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    try {
      const res = await window.electronAPI.deleteNote(id);
      if (res.success) {
        message.success('删除成功');
        loadNotes(selectedGroupId);
      } else {
        message.error(res.error || '删除失败');
      }
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingNote && editingNote.id) {
        const res = await window.electronAPI.updateNote(editingNote.id, values);
        if (res.success) message.success('更新成功'); else message.error(res.error || '更新失败');
      } else {
        const res = await window.electronAPI.addNote(values);
        if (res.success) message.success('添加成功'); else message.error(res.error || '添加失败');
      }
      setEditVisible(false);
      loadNotes(selectedGroupId);
    } catch (e) {
      message.error(editingNote ? '更新失败' : '添加失败');
    }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '分组', dataIndex: 'group_id', key: 'group_id', render: (gid: number) => {
      const g = groups.find(x => x.id === gid);
      return g ? <Tag color={g.color || 'blue'}>{g.name}</Tag> : '-';
    } },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at' },
    { title: '操作', key: 'action', render: (_: any, record: NoteRecord) => (
      <Space>
        <Button type="link" onClick={() => handleEdit(record)}>编辑</Button>
        <Button type="link" danger onClick={() => handleDelete(record.id)}>删除</Button>
      </Space>
    ) }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Select placeholder="选择分组" allowClear style={{ width: 240 }} value={selectedGroupId} onChange={(v) => { setSelectedGroupId(v); loadNotes(v); }}>
          {groups.map(g => <Select.Option key={g.id} value={g.id!}>{g.name}</Select.Option>)}
        </Select>
        <Button type="primary" onClick={handleAdd}>新建便笺</Button>
      </Space>
      <Table columns={columns as any} dataSource={notes} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title={editingNote ? '编辑便笺' : '新建便笺'} open={editVisible} onCancel={() => setEditVisible(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="标题">
            <Input placeholder="标题" />
          </Form.Item>
          <Form.Item name="content_ciphertext" label="正文" rules={[{ required: true, message: '请输入正文' }]}>
            <Input.TextArea rows={8} placeholder="自由文本" />
          </Form.Item>
          <Form.Item name="group_id" label="分组">
            <Select allowClear placeholder="选择分组">
              {groups.map(g => <Select.Option key={g.id} value={g.id!}>{g.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">保存</Button>
              <Button onClick={() => setEditVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      <Space style={{ marginTop: 12 }}>
        <Button onClick={onClose}>关闭</Button>
      </Space>
    </div>
  );
};

export default NoteManager;

