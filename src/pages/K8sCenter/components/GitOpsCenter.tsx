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
      message.success('GitOps 应用已创建');
      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['k8s', 'applications'] });
    },
    onError: (err: any) => message.error(`创建失败: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateK8sApplication(id, data),
    onSuccess: () => {
      message.success('GitOps 应用已更新');
      setIsModalVisible(false);
      setEditingApp(null);
      queryClient.invalidateQueries({ queryKey: ['k8s', 'applications'] });
    },
    onError: (err: any) => message.error(`更新失败: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteK8sApplication(id),
    onSuccess: () => {
      message.success('GitOps 应用已删除');
      queryClient.invalidateQueries({ queryKey: ['k8s', 'applications'] });
    },
    onError: (err: any) => message.error(`删除失败: ${err.message}`),
  });

  const syncMutation = useMutation({
    mutationFn: (id: number) => syncK8sApplication(id),
    onSuccess: () => {
      message.success('同步任务已触发');
      // 轮询或等待 WebSocket 更新
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['k8s', 'applications'] }), 3000);
    },
    onError: (err: any) => message.error(`同步触发失败: ${err.message}`),
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
      title: '应用名称',
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
      title: '源代码 (Git)',
      key: 'source',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: '12px' }}>
            <GithubOutlined /> {record.git_repo}
          </Text>
          <Tag size="small" color="blue">
            Branch: {record.git_branch}
          </Tag>
        </Space>
      ),
    },
    {
      title: '同步状态',
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
          <Tooltip title={record.error_message || (status === 'OutOfSync' ? '检测到配置漂移' : '')}>
            <Tag color={color} icon={icon}>
              {status}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
        title: '最近同步',
        key: 'last_sync',
        render: (_: any, record: any) => (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: '11px' }} type="secondary">
              {record.last_sync_time ? new Date(record.last_sync_time).toLocaleString() : '从未同步'}
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
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="立即同步">
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
                title: '确认删除应用?',
                content: `删除应用 "${record.name}" 不会删除集群中的资源，但将停止 GitOps 追踪。`,
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
            <Title level={5} className="m-0">GitOps 应用列表</Title>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['k8s', 'applications'] })}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
            >
              新建应用
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
        title={editingApp ? '编辑 GitOps 应用' : '新建 GitOps 应用'}
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
              label="应用名称"
              rules={[{ required: true, message: '请输入应用名称' }]}
            >
              <Input placeholder="例如: my-java-app" />
            </Form.Item>
            <Form.Item
              name="cluster"
              label="目标集群"
              rules={[{ required: true, message: '请选择目标集群' }]}
            >
              <Select
                options={(clustersData?.data || []).map((c: any) => ({ label: c.name, value: c.id }))}
                placeholder="请选择集群"
              />
            </Form.Item>
            <Form.Item
              name="namespace"
              label="目标命名空间"
              rules={[{ required: true }]}
            >
              <Input placeholder="default" />
            </Form.Item>
            <Form.Item
              name="auto_sync"
              label="自动同步"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </div>

          <Title level={5} className="mt-2 mb-4 border-b pb-2">Git 源代码配置</Title>
          
          <Form.Item
            name="git_repo"
            label="Git 仓库地址"
            rules={[{ required: true, message: '请输入 Git 仓库地址' }]}
          >
            <Input placeholder="https://github.com/org/repo.git" prefix={<GithubOutlined />} />
          </Form.Item>

          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              name="git_branch"
              label="分支"
              rules={[{ required: true }]}
            >
              <Input placeholder="main" />
            </Form.Item>
            <Form.Item
              name="path"
              label="Helm Chart 路径"
              rules={[{ required: true }]}
            >
              <Input placeholder="." help="相对于仓库根目录的路径" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default GitOpsCenter;
