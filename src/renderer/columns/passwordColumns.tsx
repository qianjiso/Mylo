import React, { useState } from 'react';
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

const UsernameCell: React.FC<{ text: string; id: number }> = ({ text, id }) => {
  const [open, setOpen] = useState(false);
  const [plain, setPlain] = useState<string | null>(null);
  const [showPlain, setShowPlain] = useState(false);
  const display = showPlain && plain ? plain : text;
  const handleClick = async () => {
    try {
      const full = await window.electronAPI.getPassword?.(id);
      const uname = full?.username || '';
      if (uname) {
        setPlain(uname);
        setShowPlain(true);
        await navigator.clipboard.writeText(uname);
        message.success('用户名已复制');
        setOpen(true);
      }
    } catch {
      message.error('复制失败');
    }
  };
  return (
    <Tooltip title={display} open={open}>
      <div
        onClick={handleClick}
        onMouseLeave={() => { setOpen(false); setShowPlain(false); }}
        style={{
          display: 'block',
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'pointer'
        }}
      >
        {display}
      </div>
    </Tooltip>
  );
};

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
  onDelete: (id: number) => void,
  rows?: PasswordRow[]
): ColumnsType<PasswordRow> {
  const maxVisibleLen = (() => {
    if (!rows || visiblePasswords.size === 0) return 0;
    let max = 0;
    for (const r of rows) {
      if (visiblePasswords.has(String(r.id)) && typeof r.password === 'string') {
        max = Math.max(max, r.password.length);
      }
    }
    return max;
  })();
  const pwdAutoWidth = maxVisibleLen > 0 ? Math.min(600, Math.max(100, maxVisibleLen * 8 + 40)) : 100;
  return [
    { title: '标题', dataIndex: 'title', key: 'title', sorter: (a, b) => a.title.localeCompare(b.title), width: 100, ellipsis: true },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 140,
      ellipsis: true,
      render: (text: string, record: PasswordRow) => {
        if (!text) return '-';
        return <UsernameCell text={text} id={record.id} />;
      }
    },
    {
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      width: pwdAutoWidth,
      render: (text: string, record: PasswordRow) => {
        if (!text) return '-';
        const isVisible = visiblePasswords.has(record.id.toString());
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ flex: 1, overflow: isVisible ? 'visible' : 'hidden', textOverflow: isVisible ? 'clip' : 'ellipsis', whiteSpace: 'nowrap', fontFamily: isVisible ? 'monospace' : 'inherit' }}>
              {isVisible ? text : '••••••••'}
            </div>
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
          </div>
        );
      },
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      width: 150,
      ellipsis: true,
      render: (text: string) => {
        if (!text) return '-';
        const isHttp = /^https?:\/\//i.test(text);
        const formatDisplayUrl = (s: string) => {
          try {
            const u = new URL(s);
            const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(u.hostname);
            let hostShow: string;
            if (isIp) {
              hostShow = u.port ? `${u.hostname}:${u.port}` : u.hostname;
            } else {
              const hostParts = u.hostname.split('.');
              const useFullHost = hostParts.length <= 3 && u.hostname.length <= 24;
              const hostShort = useFullHost ? u.hostname : `…${hostParts.slice(-2).join('.')}`;
              hostShow = u.port ? `${hostShort}:${u.port}` : hostShort;
            }
            const path = u.pathname && u.pathname !== '/' ? '/…' : '/';
            return `${u.protocol}//${hostShow}${path}`;
          } catch {
            if (s.length <= 28) return s;
            return `${s.slice(0, 20)}…${s.slice(-6)}`;
          }
        };
        const display = formatDisplayUrl(text);
        const open = async () => {
          try {
            if (isHttp && window.electronAPI?.openExternal) {
              await window.electronAPI.openExternal(text);
            } else {
              await navigator.clipboard.writeText(text);
              message.success('URL已复制');
            }
          } catch {
            message.error('操作失败');
          }
        };
        return (
          <div
            onClick={open}
            style={{
              display: 'block',
              width: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: '#1677ff',
              cursor: 'pointer'
            }}
          >
            {display}
          </div>
        );
      }
    },
    {
      title: '分组',
      dataIndex: 'group_id',
      key: 'group_id',
      width: 70,
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
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 140, render: (text: string) => formatTimestamp(text) },
    {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
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
