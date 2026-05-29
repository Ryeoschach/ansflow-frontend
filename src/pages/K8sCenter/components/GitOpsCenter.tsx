import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Typography,
  Card,
  App,
  theme,
  Tooltip,
  Badge,
  Descriptions,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SyncOutlined,
  GithubOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getK8sApplications,
  createK8sApplication,
  updateK8sApplication,
  deleteK8sApplication,
  syncK8sApplication,
  getK8sClusters,
} from '../../../api/k8s';
import useAppStore from "../../../store/useAppStore.ts";
import useBreakpoint from '../../../utils/useBreakpoint';

const { Title, Text } = Typography;

const GitOpsCenter: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal: antModal } = App.useApp();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();
  const { hasPermission } = useAppStore();
  const { isMobile } = useBreakpoint();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingApp, setEditingApp] = useState<any>(null);
  const [form] = Form.useForm();

  // Queries
  const { data: appsData, isLoading: appsLoading } = useQuery({
    queryKey: ['k8s', 'applications'],
    queryFn: () => getK8sApplications({ page: 1, size: 100 }),
  });

  const { data: clustersData } = useQuery({
    queryKey: ['k8s', 'clusters'],
    queryFn: () => getK8sClusters({ page: 1, size: 100 }),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => createK8sApplication(data),
    onSuccess: () => {
      message.success(t('gitops.createSuccess'));
      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['k8s', 'applications'] });
    },
    onError: (err: any) => message.error(t('gitops.createFailed', { message: err.message })),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateK8sApplication(id, data),
    onSuccess: () => {
      message.success(t('gitops.updateSuccess'));
      setIsModalVisible(false);
      setEditingApp(null);
      queryClient.invalidateQueries({ queryKey: ['k8s', 'applications'] });
    },
    onError: (err: any) => message.error(t('gitops.updateFailed', { message: err.message })),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteK8sApplication(id),
    onSuccess: () => {
      message.success(t('gitops.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['k8s', 'applications'] });
    },
    onError: (err: any) => message.error(t('gitops.deleteFailed', { message: err.message })),
  });

  const syncMutation = useMutation({
    mutationFn: (id: number) => syncK8sApplication(id),
    onSuccess: () => {
      message.success(t('gitops.syncTriggered'));
      // Poll until the WebSocket update arrives.
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['k8s', 'applications'] }), 3000);
    },
    onError: (err: any) => message.error(t('gitops.syncFailed', { message: err.message })),
  });

  const showModal = (app?: any) => {
    setEditingApp(app || null);
    if (app) {
      form.setFieldsValue(app);
    } else {
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const columns = [
    {
      title: t('gitops.appName'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            <GlobalOutlined /> {record.cluster_name} / {record.namespace}
          </Text>
        </Space>
      ),
    },
    {
      title: t('gitops.sourceCode'),
      key: 'source',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: '12px' }}>
            <GithubOutlined /> {record.git_repo}
          </Text>
          <Tag color="blue">
            {t('gitops.branch', { branch: record.git_branch })}
          </Tag>
        </Space>
      ),
    },
    {
      title: t('gitops.syncStatus'),
      dataIndex: 'sync_status',
      key: 'sync_status',
      render: (status: string, record: any) => {
        let color = 'default';
        let icon = null;
        if (status === 'Synced') {
          color = 'success';
          icon = <CheckCircleOutlined />;
        } else if (status === 'OutOfSync') {
          color = 'warning';
          icon = <ExclamationCircleOutlined />;
        } else if (status === 'Error') {
          color = 'error';
          icon = <ExclamationCircleOutlined />;
        }
        return (
          <Tooltip title={record.error_message || (status === 'OutOfSync' ? t('gitops.driftDetected') : '')}>
            <Tag color={color} icon={icon}>
              {status}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
        title: t('gitops.lastSync'),
        key: 'last_sync',
        render: (_: any, record: any) => (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: '11px' }} type="secondary">
              {record.last_sync_time ? new Date(record.last_sync_time).toLocaleString() : t('gitops.neverSynced')}
            </Text>
            {record.last_sync_revision && (
              <Text code style={{ fontSize: '10px' }}>
                {record.last_sync_revision.substring(0, 7)}
              </Text>
            )}
          </Space>
        ),
    },
    {
      title: t('common.actions'),
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title={t('gitops.syncNow')}>
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined />}
              onClick={() => syncMutation.mutate(record.id)}
              loading={syncMutation.isPending && syncMutation.variables === record.id}
            />
          </Tooltip>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          />
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              antModal.confirm({
                title: t('gitops.confirmDeleteTitle'),
                content: t('gitops.confirmDeleteContent', { name: record.name }),
                onOk: () => deleteMutation.mutate(record.id),
              });
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="p-0">
      <Card
        title={
          <Space>
            <SyncOutlined style={{ color: token.colorPrimary }} />
            <Title level={5} className="m-0">{t('gitops.appList')}</Title>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['k8s', 'applications'] })}
            >
              {t('gitops.refresh')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
            >
              {t('gitops.createApp')}
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={appsData?.data || []}
          loading={appsLoading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingApp ? t('gitops.editApp') : t('gitops.createAppTitle')}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            if (editingApp) {
              updateMutation.mutate({ id: editingApp.id, data: values });
            } else {
              createMutation.mutate(values);
            }
          }}
          initialValues={{ git_branch: 'main', namespace: 'default', auto_sync: false }}
        >
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              name="name"
              label={t('gitops.appName')}
              rules={[{ required: true, message: t('gitops.appNameRequired') }]}
            >
              <Input placeholder={t('gitops.appNamePlaceholder')} />
            </Form.Item>
            <Form.Item
              name="cluster"
              label={t('gitops.targetCluster')}
              rules={[{ required: true, message: t('gitops.targetClusterRequired') }]}
            >
              <Select
                options={(clustersData?.data || []).map((c: any) => ({ label: c.name, value: c.id }))}
                placeholder={t('gitops.selectCluster')}
              />
            </Form.Item>
            <Form.Item
              name="namespace"
              label={t('gitops.targetNamespace')}
              rules={[{ required: true }]}
            >
              <Input placeholder="default" />
            </Form.Item>
            <Form.Item
              name="auto_sync"
              label={t('gitops.autoSync')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </div>

          <Title level={5} className="mt-2 mb-4 border-b pb-2">{t('gitops.gitSourceConfig')}</Title>
          
          <Form.Item
            name="git_repo"
            label={t('gitops.gitRepo')}
            rules={[{ required: true, message: t('gitops.gitRepoRequired') }]}
          >
            <Input placeholder="https://github.com/org/repo.git" prefix={<GithubOutlined />} />
          </Form.Item>

          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              name="git_branch"
              label={t('gitops.branchName')}
              rules={[{ required: true }]}
            >
              <Input placeholder="main" />
            </Form.Item>
            <Form.Item
              name="path"
              label={t('gitops.chartPath')}
              rules={[{ required: true }]}
              help={t('gitops.chartPathHelp')}
            >
              <Input placeholder="." />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default GitOpsCenter;
