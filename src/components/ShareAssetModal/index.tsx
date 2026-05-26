/**
 * ShareAssetModal — 跨项目资产授权弹窗
 *
 * 用法：
 *   <ShareAssetModal
 *     open={visible}
 *     onClose={() => setVisible(false)}
 *     assetType="host"
 *     assetId={record.id}
 *     assetName={record.hostname}
 *     fromProjectId={currentProject.id}
 *   />
 */
import React, { useState } from 'react';
import {
  Modal, Form, Select, Tag, Table, Popconfirm,
  Button, Space, Typography, App, Divider, Badge,
} from 'antd';
import {
  ShareAltOutlined, DeleteOutlined, PlusOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAssetShare, deleteAssetShare, getSharedOut,
  AssetType, SharePermission, PERMISSION_LABELS, AssetShare,
} from '../../api/assetShare';
import { getProjects } from '../../api/rbac';
import useAppStore from '../../store/useAppStore';

const { Text } = Typography;

const PERMISSION_COLOR: Record<SharePermission, string> = {
  read: 'default',
  use:  'blue',
  full: 'orange',
};

interface ShareAssetModalProps {
  open: boolean;
  onClose: () => void;
  assetType: AssetType;
  assetId: number;
  assetName: string;
  fromProjectId: number;
}

const ShareAssetModal: React.FC<ShareAssetModalProps> = ({
  open, onClose, assetType, assetId, assetName, fromProjectId,
}) => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const currentProject = useAppStore((s) => s.currentProject);

  // ── 已有授权列表 ────────────────────────────────────────────
  const { data: allSharedOut = [], isLoading: sharesLoading } = useQuery({
    queryKey: ['shared-out', fromProjectId],
    queryFn: getSharedOut,
    enabled: open,
  });

  // 只显示当前资产的授权记录
  const existingShares: AssetShare[] = allSharedOut.filter(
    (s) => s.asset_type === assetType && s.asset_id === assetId,
  );

  // ── 项目列表（排除当前项目）────────────────────────────────
  const { data: projectsResp } = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => getProjects({ page_size: 999 }),
    enabled: open,
  });
  const projects = (projectsResp?.data ?? []).filter(
    (p: any) => p.id !== fromProjectId,
  );

  // ── 创建授权 ─────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createAssetShare,
    onSuccess: () => {
      message.success('授权成功');
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['shared-out'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.non_field_errors?.[0] || '授权失败');
    },
  });

  // ── 撤销授权 ─────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: deleteAssetShare,
    onSuccess: () => {
      message.success('已撤销授权');
      queryClient.invalidateQueries({ queryKey: ['shared-out'] });
    },
  });

  const handleSubmit = (values: any) => {
    createMutation.mutate({
      from_project: fromProjectId,
      to_project: values.to_project,
      asset_type: assetType,
      asset_id: assetId,
      permission: values.permission,
    });
  };

  const columns = [
    {
      title: '目标项目',
      dataIndex: 'to_project_name',
      key: 'to_project_name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '权限',
      dataIndex: 'permission',
      key: 'permission',
      render: (p: SharePermission) => (
        <Tag color={PERMISSION_COLOR[p]}>{PERMISSION_LABELS[p]}</Tag>
      ),
    },
    {
      title: '授权人',
      dataIndex: 'shared_by_name',
      key: 'shared_by_name',
      render: (name: string) => <Text type="secondary">{name ?? '-'}</Text>,
    },
    {
      title: '授权时间',
      dataIndex: 'create_time',
      key: 'create_time',
      render: (t: string) => new Date(t).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AssetShare) => (
        <Popconfirm
          title="确认撤销该项授权？"
          onConfirm={() => deleteMutation.mutate(record.id)}
          okText="撤销"
          okButtonProps={{ danger: true }}
          cancelText="取消"
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small">
            撤销
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <ShareAltOutlined style={{ color: '#1677ff' }} />
          <span>跨项目授权</span>
          <Tag color="processing">{assetName}</Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={680}
      destroyOnHidden
    >
      {/* 新增授权表单 */}
      <Form
        form={form}
        layout="inline"
        onFinish={handleSubmit}
        style={{ marginBottom: 16 }}
        initialValues={{ permission: 'use' }}
      >
        <Form.Item
          name="to_project"
          rules={[{ required: true, message: '请选择目标项目' }]}
          style={{ flex: 1, minWidth: 180 }}
        >
          <Select
            placeholder="选择目标项目"
            showSearch
            filterOption={(input, opt) =>
              (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            options={projects.map((p: any) => ({ label: p.name, value: p.id }))}
          />
        </Form.Item>

        <Form.Item name="permission" rules={[{ required: true }]}>
          <Select
            style={{ width: 130 }}
            options={[
              { label: '只读', value: 'read' },
              { label: '可执行', value: 'use' },
              { label: '完全控制', value: 'full' },
            ]}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<PlusOutlined />}
            loading={createMutation.isPending}
          >
            授权
          </Button>
        </Form.Item>
      </Form>

      <Divider style={{ margin: '8px 0 12px' }}>
        <Space>
          <span>已授权项目</span>
          <Badge count={existingShares.length} showZero color="#1677ff" />
        </Space>
      </Divider>

      <Table
        dataSource={existingShares}
        columns={columns}
        rowKey="id"
        loading={sharesLoading}
        size="small"
        pagination={false}
        locale={{ emptyText: '暂无授权记录，此资产仅当前项目可见' }}
      />
    </Modal>
  );
};

export default ShareAssetModal;
