/**
 * AssetShareCenter — 跨项目资产授权管理中心
 *
 * 两个 Tab：
 * - 我共享的 (shared_out) : 当前项目已授权给其他项目的资产
 * - 共享给我的 (shared_in)  : 其他项目授权给当前项目的资产（只读查看）
 */
import React, { useState } from 'react';
import {
  Card, Tabs, Table, Tag, Button, Popconfirm, Space,
  Typography, App, Badge, Empty, Tooltip, Select,
} from 'antd';
import {
  ShareAltOutlined, DeleteOutlined, InboxOutlined, SendOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSharedOut, getSharedIn, deleteAssetShare, revokeAssetShares,
  AssetShare, SharePermission, AssetType,
} from '../../api/assetShare';
import useAppStore from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

const PERMISSION_COLOR: Record<SharePermission, string> = {
  read: 'default',
  use: 'blue',
  full: 'orange',
};

const ASSET_TYPE_COLOR: Record<AssetType, string> = {
  host: 'green',
  ssh_credential: 'purple',
  credential: 'volcano',
  pipeline: 'blue',
  ansible_task: 'cyan',
  k8s_cluster: 'geekblue',
  resource_pool: 'lime',
  self_healing_policy: 'gold',
};

const AssetShareCenter: React.FC = () => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currentProject = useAppStore((s) => s.currentProject);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [filterType, setFilterType] = useState<string>('');

  // ── 我共享的 ─────────────────────────────────────────────────
  const { data: sharedOut = [], isLoading: outLoading } = useQuery({
    queryKey: ['shared-out', currentProject?.id],
    queryFn: getSharedOut,
    enabled: !!currentProject,
  });

  // ── 共享给我的 ───────────────────────────────────────────────
  const { data: sharedIn = [], isLoading: inLoading } = useQuery({
    queryKey: ['shared-in', currentProject?.id],
    queryFn: getSharedIn,
    enabled: !!currentProject,
  });

  // ── 撤销单条 ────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: deleteAssetShare,
    onSuccess: () => {
      message.success(t('assetShare.revoked'));
      queryClient.invalidateQueries({ queryKey: ['shared-out'] });
    },
  });

  // ── 批量撤销 ────────────────────────────────────────────────
  const bulkRevokeMutation = useMutation({
    mutationFn: revokeAssetShares,
    onSuccess: () => {
      message.success(t('assetShare.bulkRevoked', { count: selectedRowKeys.length }));
      setSelectedRowKeys([]);
      queryClient.invalidateQueries({ queryKey: ['shared-out'] });
    },
  });

  // ── 过滤 ────────────────────────────────────────────────────
  const filteredOut = filterType
    ? sharedOut.filter((s) => s.asset_type === filterType)
    : sharedOut;

  const filteredIn = filterType
    ? sharedIn.filter((s) => s.asset_type === filterType)
    : sharedIn;

  // ── 共享列（通用）───────────────────────────────────────────
  const baseColumns = [
    {
      title: t('assetShare.assetType'),
      dataIndex: 'asset_type',
      key: 'asset_type',
      render: (type: AssetType) => (
        <Tag color={ASSET_TYPE_COLOR[type] ?? 'default'}>
          {t(`assetShare.assetTypes.${type}`, type)}
        </Tag>
      ),
    },
    {
      title: t('assetShare.assetId'),
      dataIndex: 'asset_id',
      key: 'asset_id',
      render: (id: number) => <Text code>{id}</Text>,
    },
    {
      title: t('assetShare.permission'),
      dataIndex: 'permission',
      key: 'permission',
      render: (p: SharePermission) => (
        <Tag color={PERMISSION_COLOR[p]}>{t(`assetShare.${p}`)}</Tag>
      ),
    },
    {
      title: t('assetShare.sharedBy'),
      dataIndex: 'shared_by_name',
      key: 'shared_by_name',
      render: (n: string) => <Text type="secondary">{n ?? '-'}</Text>,
    },
    {
      title: t('assetShare.sharedAt'),
      dataIndex: 'create_time',
      key: 'create_time',
      render: (t: string) => new Date(t).toLocaleString(),
    },
  ];

  // ── 已共享表格列（含目标项目 + 撤销按钮）──────────────────────
  const outColumns = [
    ...baseColumns.slice(0, 2),
    {
      title: t('assetShare.targetProject'),
      dataIndex: 'to_project_name',
      key: 'to_project_name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    ...baseColumns.slice(2),
    {
      title: t('common.actions'),
      key: 'action',
      render: (_: any, record: AssetShare) => (
        <Popconfirm
          title={t('assetShare.revokeAccessConfirm')}
          onConfirm={() => deleteMutation.mutate(record.id)}
          okText={t('assetShare.revoke')}
          okButtonProps={{ danger: true }}
          cancelText={t('common.cancel')}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small">
            {t('assetShare.revoke')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // ── 收到授权表格列（含来源项目，只读）──────────────────────────
  const inColumns = [
    ...baseColumns.slice(0, 2),
    {
      title: t('assetShare.sourceProject'),
      dataIndex: 'from_project_name',
      key: 'from_project_name',
      render: (name: string) => (
        <Tag icon={<ShareAltOutlined />} color="processing">{name}</Tag>
      ),
    },
    ...baseColumns.slice(2),
  ];

  // ── 过滤器 ──────────────────────────────────────────────────
  const assetTypes: AssetType[] = ['host', 'ssh_credential', 'credential', 'pipeline', 'ansible_task', 'k8s_cluster', 'resource_pool', 'self_healing_policy'];
  const typeFilterOptions = assetTypes.map((type) => ({
    label: t(`assetShare.assetTypes.${type}`),
    value: type,
  }));

  const FilterBar = () => (
    <Select
      allowClear
      placeholder={t('assetShare.filterByType')}
      style={{ width: 160 }}
      options={typeFilterOptions}
      value={filterType || undefined}
      onChange={(v) => setFilterType(v ?? '')}
    />
  );

  if (!currentProject) {
    return (
      <Card className="m-4">
        <Empty description={t('assetShare.selectProjectFirst')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  return (
    <Card
      className="m-4 shadow-sm"
      title={
        <Space>
          <ShareAltOutlined style={{ color: '#1677ff' }} />
          <span>{t('assetShare.centerTitle')}</span>
          <Tag color="blue">{currentProject.name}</Tag>
        </Space>
      }
    >
      <Tabs
        defaultActiveKey="out"
        items={[
          {
            key: 'out',
            label: (
              <Space>
                <SendOutlined />
                {t('assetShare.sharedOut')}
                <Badge count={sharedOut.length} size="small" color="#1677ff" />
              </Space>
            ),
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <FilterBar />
                  {selectedRowKeys.length > 0 && (
                    <Popconfirm
                      title={t('assetShare.bulkRevokeConfirm', { count: selectedRowKeys.length })}
                      onConfirm={() => bulkRevokeMutation.mutate(selectedRowKeys)}
                      okText={t('assetShare.bulkRevoke')}
                      okButtonProps={{ danger: true }}
                    >
                      <Button danger icon={<DeleteOutlined />} loading={bulkRevokeMutation.isPending}>
                        {t('assetShare.bulkRevoke')} ({selectedRowKeys.length})
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
                <Table
                  rowKey="id"
                  columns={outColumns}
                  dataSource={filteredOut}
                  loading={outLoading}
                  size="small"
                  scroll={{ x: 'max-content' }}
                  rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys as number[]),
                  }}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('assetShare.emptySharedOut')}
                      />
                    ),
                  }}
                  pagination={{ pageSize: 15, showSizeChanger: false }}
                />
              </Space>
            ),
          },
          {
            key: 'in',
            label: (
              <Space>
                <InboxOutlined />
                {t('assetShare.sharedIn')}
                <Badge count={sharedIn.length} size="small" color="green" />
              </Space>
            ),
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <FilterBar />
                <Table
                  rowKey="id"
                  columns={inColumns}
                  dataSource={filteredIn}
                  loading={inLoading}
                  size="small"
                  scroll={{ x: 'max-content' }}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('assetShare.emptySharedIn')}
                      />
                    ),
                  }}
                  pagination={{ pageSize: 15, showSizeChanger: false }}
                />
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
};

export default AssetShareCenter;
