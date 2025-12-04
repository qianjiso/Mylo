import React from 'react';
import { Button, Tag, Tooltip, Space, Popconfirm, message } from 'antd';
import { FolderOutlined, EditOutlined, DeleteOutlined, HistoryOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { formatTimestamp } from '../utils/time';

export interface PasswordRow {
  id: number;
  title: string;
  username: string;
  password: string;
  url?: string;
  group_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface GroupLite {
  id?: number;
  name: string;
  color?: string;
  icon?: string;
}

/**
 * 构建密码列表的列配置
 * @param groups 分组数据源（用于渲染分组标签）
 * @param visiblePasswords 当前可见密码集合（按行 id 存储）
 * @param toggleVisibility 切换某行密码明文/掩码显示
 * @param onViewHistory 查看历史记录的回调
 * @param onEdit 编辑密码的回调
 * @param onDelete 删除密码的回调
 * @returns Antd Table 的列配置
 */
export function buildPasswordColumns(
  groups: GroupLite[],
  visiblePasswords: Set<string>,
  toggleVisibility: (rowId: string) => void,
  onViewHistory: (row: PasswordRow) => void,
  onEdit: (row: PasswordRow) => void,
  onDelete: (id: number) => void
): ColumnsType<PasswordRow> {
  return [
    { title: '标题', dataIndex: 'title', key: 'title', sorter: (a, b) => a.title.localeCompare(b.title) },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      render: (text: string, record: PasswordRow) => {
        if (!text) return '-';
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
              onClick={async () => {
                toggleVisibility(record.id.toString());
                if (record.password) {
                  await navigator.clipboard.writeText(record.password)
                    .then(() => message.success('密码已复制'))
                    .catch(() => message.error('复制失败'));
                }
              }}
            />
          </Space>
        );
      },
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      render: (text: string) => (text ? <a href={text} target="_blank" rel="noopener noreferrer">{text}</a> : '-'),
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
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (text: string) => formatTimestamp(text) },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="历史">
            <Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => onViewHistory(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)} />
          </Tooltip>
          <Popconfirm title="确定要删除这个密码吗？" onConfirm={() => onDelete(record.id)} okText="确定" cancelText="取消">
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}
