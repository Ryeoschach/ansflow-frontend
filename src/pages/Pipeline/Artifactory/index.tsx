import React, { useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Typography, App, Popconfirm, message, Tabs, Badge, Descriptions, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CloudOutlined, DatabaseOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getArtifactoryInstances,
  createArtifactoryInstance,
  updateArtifactoryInstance,
  deleteArtifactoryInstance,
  testArtifactoryConnection,
  getArtifactoryRepositories,
  createArtifactoryRepository,
  updateArtifactoryRepository,
  deleteArtifactoryRepository,
  type ArtifactoryInstance,
  type ArtifactoryRepository,
  type RepoType,
} from '../../../api/artifactory';
import useAppStore from '../../../store/useAppStore';

const { Text } = Typography;

const Artifactory: React.FC = () => {
  const { t } = useTranslation();
  const { message: antMessage } = App.useApp();
  const { token: authToken, hasPermission } = useAppStore();
  const queryClient = useQueryClient();

  // ==================== 状态 ====================
  const [activeTab, setActiveTab] = useState<'instances' | 'repositories'>('instances');

  // 实例相关
  const [instanceModalOpen, setInstanceModalOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<ArtifactoryInstance | null>(null);
  const [instanceForm] = Form.useForm();

  // 仓库相关
  const [repoModalOpen, setRepoModalOpen] = useState(false);
  const [editingRepo, setEditingRepo] = useState<ArtifactoryRepository | null>(null);
  const [repoForm] = Form.useForm();

  // ==================== 权限 ====================
  const canManageInstance = hasPermission('registry:artifactory:add') || hasPermission('registry:artifactory:edit') || hasPermission('registry:artifactory:delete');
  const canManageRepo = hasPermission('registry:artifactory:add') || hasPermission('registry:artifactory:edit') || hasPermission('registry:artifactory:delete');

  // ==================== 实例查询 ====================
  const { data: instancesData, isLoading: instancesLoading, refetch: refetchInstances } = useQuery({
    queryKey: ['artifactory-instances'],
    queryFn: () => getArtifactoryInstances({ page: 1, page_size: 100 }),
    enabled: !!authToken,
  });

  // ==================== 仓库查询 ====================
  const { data: reposData, isLoading: reposLoading, refetch: refetchRepos } = useQuery({
    queryKey: ['artifactory-repositories'],
    queryFn: () => getArtifactoryRepositories({ page: 1, page_size: 100 }),
    enabled: !!authToken,
  });

  // ==================== 实例 mutations ====================
  const saveInstanceMutation = useMutation({
    mutationFn: (values: any) => editingInstance
      ? updateArtifactoryInstance(editingInstance.id, values)
      : createArtifactoryInstance(values),
    onSuccess: () => {
      antMessage.success(editingInstance ? t('common.updateSuccess') : t('common.createSuccess'));
      setInstanceModalOpen(false);
      setEditingInstance(null);
      instanceForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['artifactory-instances'] });
    },
    onError: (err: any) => {
      antMessage.error(err?.response?.data?.message || err?.message || t('common.operationFailed'));
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: deleteArtifactoryInstance,
    onSuccess: () => {
      antMessage.success(t('common.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['artifactory-instances'] });
    },
    onError: (err: any) => {
      antMessage.error(err?.response?.data?.message || err?.message || t('common.operationFailed'));
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: testArtifactoryConnection,
    onSuccess: (res) => {
      if (res.status === 'ok') {
        antMessage.success(res.message || t('artifactory.connectionSuccess'));
      } else {
        antMessage.error(res.message || t('artifactory.connectionFailed'));
      }
    },
    onError: (err: any) => {
      antMessage.error(err?.response?.data?.message || t('artifactory.connectionFailed'));
    },
  });

  // ==================== 仓库 mutations ====================
  const saveRepoMutation = useMutation({
    mutationFn: (values: any) => editingRepo
      ? updateArtifactoryRepository(editingRepo.id, values)
      : createArtifactoryRepository(values),
    onSuccess: () => {
      antMessage.success(editingRepo ? t('common.updateSuccess') : t('common.createSuccess'));
      setRepoModalOpen(false);
      setEditingRepo(null);
      repoForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['artifactory-repositories'] });
    },
    onError: (err: any) => {
      antMessage.error(err?.response?.data?.message || err?.message || t('common.operationFailed'));
    },
  });

  const deleteRepoMutation = useMutation({
    mutationFn: deleteArtifactoryRepository,
    onSuccess: () => {
      antMessage.success(t('common.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['artifactory-repositories'] });
    },
    onError: (err: any) => {
      antMessage.error(err?.response?.data?.message || err?.message || t('common.operationFailed'));
    },
  });

  // ==================== 辅助函数 ====================
  const repoTypeMap: Record<RepoType, { text: string; color: string }> = {
    maven: { text: 'Maven', color: 'orange' },
    npm: { text: 'npm', color: 'green' },
    generic: { text: 'Generic', color: 'blue' },
    helm: { text: 'Helm', color: 'purple' },
    docker: { text: 'Docker', color: 'cyan' },
    pypi: { text: 'PyPI', color: 'magenta' },
    go: { text: 'Go', color: 'geekblue' },
    other: { text: 'Other', color: 'default' },
  };

  // ==================== 实例表格列 ====================
  const instanceColumns = [
    {
      title: t('artifactory.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string) => <Space><CloudOutlined /> {text}</Space>,
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (url: string) => <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>,
    },
    {
      title: t('artifactory.username'),
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: t('artifactory.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => isActive
        ? <Tag icon={<CheckCircleOutlined />} color="success">{t('common.active')}</Tag>
        : <Tag icon={<CloseCircleOutlined />} color="error">{t('common.inactive')}</Tag>,
    },
    {
      title: t('common.createTime'),
      dataIndex: 'create_time',
      key: 'create_time',
      render: (time: string) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: any, record: ArtifactoryInstance) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<ApiOutlined />}
            onClick={() => testConnectionMutation.mutate(record.id)}
            loading={testConnectionMutation.isPending}
          >
            {t('artifactory.testConnection')}
          </Button>
          {hasPermission('registry:artifactory:edit') && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
              setEditingInstance(record);
              instanceForm.setFieldsValue(record);
              setInstanceModalOpen(true);
            }} />
          )}
          {hasPermission('registry:artifactory:delete') && (
            <Popconfirm
              title={t('common.deleteConfirm')}
              onConfirm={() => deleteInstanceMutation.mutate(record.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // ==================== 仓库表格列 ====================
  const repoColumns = [
    {
      title: t('artifactory.repoKey'),
      dataIndex: 'repo_key',
      key: 'repo_key',
      ellipsis: true,
      render: (text: string) => <Space><DatabaseOutlined /> {text}</Space>,
    },
    {
      title: t('artifactory.instance'),
      dataIndex: 'instance_name',
      key: 'instance_name',
      render: (name: string, record: ArtifactoryRepository) => (
        <a href={record.instance_url} target="_blank" rel="noopener noreferrer">{name}</a>
      ),
    },
    {
      title: t('artifactory.repoType'),
      dataIndex: 'repo_type',
      key: 'repo_type',
      render: (type: RepoType) => {
        const item = repoTypeMap[type] || repoTypeMap.other;
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    {
      title: t('artifactory.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => isActive
        ? <Tag icon={<CheckCircleOutlined />} color="success">{t('common.active')}</Tag>
        : <Tag icon={<CloseCircleOutlined />} color="error">{t('common.inactive')}</Tag>,
    },
    {
      title: t('common.createTime'),
      dataIndex: 'create_time',
      key: 'create_time',
      render: (time: string) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: any, record: ArtifactoryRepository) => (
        <Space>
          {hasPermission('registry:artifactory:edit') && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
              setEditingRepo(record);
              repoForm.setFieldsValue({
                ...record,
                instance: record.instance,
              });
              setRepoModalOpen(true);
            }} />
          )}
          {hasPermission('registry:artifactory:delete') && (
            <Popconfirm
              title={t('common.deleteConfirm')}
              onConfirm={() => deleteRepoMutation.mutate(record.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Card
        title={
          <Space>
            <ApiOutlined />
            {t('artifactory.title')}
          </Space>
        }
        extra={
          canManageInstance && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingInstance(null);
                instanceForm.resetFields();
                setInstanceModalOpen(true);
              }}
            >
              {t('artifactory.addInstance')}
            </Button>
          )
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'instances' | 'repositories')}
          items={[
            {
              key: 'instances',
              label: (
                <Space>
                  <CloudOutlined />
                  {t('artifactory.instances')}
                  <Badge count={instancesData?.total || 0} size="small" />
                </Space>
              ),
              children: (
                <Table
                  columns={instanceColumns}
                  dataSource={instancesData?.data || []}
                  rowKey="id"
                  loading={instancesLoading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'repositories',
              label: (
                <Space>
                  <DatabaseOutlined />
                  {t('artifactory.repositories')}
                  <Badge count={reposData?.total || 0} size="small" />
                </Space>
              ),
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <div className="flex justify-end">
                    {canManageRepo && (
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setEditingRepo(null);
                          repoForm.resetFields();
                          setRepoModalOpen(true);
                        }}
                      >
                        {t('artifactory.addRepo')}
                      </Button>
                    )}
                  </div>
                  <Table
                    columns={repoColumns}
                    dataSource={reposData?.data || []}
                    rowKey="id"
                    loading={reposLoading}
                    pagination={{ pageSize: 10 }}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* 实例创建/编辑 Modal */}
      <Modal
        title={editingInstance ? t('artifactory.editInstance') : t('artifactory.addInstance')}
        open={instanceModalOpen}
        onCancel={() => {
          setInstanceModalOpen(false);
          setEditingInstance(null);
          instanceForm.resetFields();
        }}
        onOk={() => instanceForm.validateFields().then((values) => {
          saveInstanceMutation.mutate(values);
        })}
        confirmLoading={saveInstanceMutation.isPending}
      >
        <Form form={instanceForm} layout="vertical">
          <Form.Item
            name="name"
            label={t('artifactory.name')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input placeholder={t('artifactory.namePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="url"
            label="URL"
            rules={[
              { required: true, message: t('common.required') },
              { type: 'url', message: t('artifactory.urlInvalid') },
            ]}
          >
            <Input placeholder="https://jfrog.company.com/artifactory" />
          </Form.Item>
          <Form.Item
            name="username"
            label={t('artifactory.username')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="api_key"
            label={t('artifactory.apiKey')}
            rules={[{ required: !editingInstance, message: t('common.required') }]}
            extra={editingInstance ? t('artifactory.apiKeyTip') : ''}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="description" label={t('artifactory.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="is_active" label={t('common.status')} initialValue={true}>
            <Select>
              <Select.Option value={true}>{t('common.active')}</Select.Option>
              <Select.Option value={false}>{t('common.inactive')}</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 仓库创建/编辑 Modal */}
      <Modal
        title={editingRepo ? t('artifactory.editRepo') : t('artifactory.addRepo')}
        open={repoModalOpen}
        onCancel={() => {
          setRepoModalOpen(false);
          setEditingRepo(null);
          repoForm.resetFields();
        }}
        onOk={() => repoForm.validateFields().then((values) => {
          saveRepoMutation.mutate(values);
        })}
        confirmLoading={saveRepoMutation.isPending}
      >
        <Form form={repoForm} layout="vertical">
          <Form.Item
            name="instance"
            label={t('artifactory.instance')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Select
              placeholder={t('artifactory.selectInstance')}
              showSearch
              optionFilterProp="label"
              options={instancesData?.data?.map((i: any) => ({
                value: i.id,
                label: `${i.name} (${i.url})`,
              })) || []}
            />
          </Form.Item>
          <Form.Item
            name="repo_key"
            label={t('artifactory.repoKey')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input placeholder="libs-release" />
          </Form.Item>
          <Form.Item
            name="repo_type"
            label={t('artifactory.repoType')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Select placeholder={t('artifactory.selectRepoType')}>
              <Select.Option value="maven">{t('artifactory.repoTypeMaven')}</Select.Option>
              <Select.Option value="npm">{t('artifactory.repoTypeNpm')}</Select.Option>
              <Select.Option value="generic">{t('artifactory.repoTypeGeneric')}</Select.Option>
              <Select.Option value="helm">{t('artifactory.repoTypeHelm')}</Select.Option>
              <Select.Option value="docker">{t('artifactory.repoTypeDocker')}</Select.Option>
              <Select.Option value="pypi">{t('artifactory.repoTypePypi')}</Select.Option>
              <Select.Option value="go">{t('artifactory.repoTypeGo')}</Select.Option>
              <Select.Option value="other">{t('artifactory.repoTypeOther')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label={t('artifactory.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="is_active" label={t('common.status')} initialValue={true}>
            <Select>
              <Select.Option value={true}>{t('common.active')}</Select.Option>
              <Select.Option value={false}>{t('common.inactive')}</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Artifactory;
