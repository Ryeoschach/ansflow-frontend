import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Form,
  Input,
  Select,
  Typography,
  Card,
  Tabs,
  Badge,
  Modal,
  App,
  Tooltip,
  theme,
  InputNumber,
} from 'antd';
import { useTranslation } from 'react-i18next';
import {
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  ApiOutlined,
  FileTextOutlined,
  EditOutlined,
  SyncOutlined,
  CodeOutlined,
  ConsoleSqlOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getK8sClusters,
  createK8sCluster,
  deleteK8sCluster,
  verifyK8sCluster,
  getK8sNodes,
  getK8sNamespaces,
  getK8sPods,
  getK8sDeployments,
  getK8sServices,
  getK8sPodLogs,
  scaleK8sDeployment,
  restartK8sDeployment,
  getK8sYaml,
  updateK8sYaml,
  execK8sPodCommand,
  deleteK8sPod,
} from '../../api/k8s';
import { K8sResource } from '../../types';
import request from "../../utils/requests";
import useAppStore from "../../store/useAppStore.ts";
import useBreakpoint from '../../utils/useBreakpoint';

import useK8sStore from "../../store/useK8sStore";

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * @name K8sCenter
 * @description K8s 云原生中心主页面。提供多集群管理、资源（Pod/Node/Deploy/Svc）巡检、YAML 编辑、终端执行及日志审计功能。
 */
const K8sCenter: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const { hasPermission } = useAppStore();
  const { isMobile } = useBreakpoint();
  
  // 接入 Zustand 持久化状态集
  const { 
    activeClusterId, setActiveClusterId, 
    activeNamespace, setActiveNamespace 
  } = useK8sStore();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  
  // 仅保留临时选中的集群对象用于 UI 回显
  const [selectedCluster, setSelectedCluster] = useState<K8sResource | null>(null);
  
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Logs & Operations
  const [isLogModalVisible, setIsLogModalVisible] = useState(false);
  const [logPod, setLogPod] = useState<any>(null);
  const [podLogs, setPodLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);

  const [isScaleModalVisible, setIsScaleModalVisible] = useState(false);
  const [scaleDeployment, setScaleDeployment] = useState<any>(null);
  const [scaleReplicas, setScaleReplicas] = useState<number>(1);

  // YAML Editing State
  const [isYamlModalVisible, setIsYamlModalVisible] = useState(false);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [yamlLoading, setYamlLoading] = useState(false);
  const [yamlTarget, setYamlTarget] = useState<{ type: string; name: string; namespace?: string } | null>(null);

  // Shell Execution State
  const [isShellModalVisible, setIsShellModalVisible] = useState(false);
  const [shellTarget, setShellTarget] = useState<any>(null);
  const [shellCommand, setShellCommand] = useState<string>('ls -l');
  const [shellOutput, setShellOutput] = useState<string>('');

  /**
   * @section 业务变更指令 (Mutations)
   */

  /** @description 资源扩缩容：适用于 Deployment */
  const scaleMutation = useMutation({
    mutationFn: (data: { namespace: string; name: string; replicas: number }) =>
      scaleK8sDeployment(activeClusterId!, data),
    onSuccess: (res) => {
      message.success((res as any).data?.msg || (res as any).msg);
      setIsScaleModalVisible(false);
      // 精确失效当前集群的所有 Deployment 缓存
      queryClient.invalidateQueries({ queryKey: ['k8s', activeClusterId, 'deployments'] });
    },
  });

  /** @description 滚动重启：触发 Deployment 进行滚动更新 */
  const restartMutation = useMutation({
    mutationFn: (data: { namespace: string; name: string }) =>
      restartK8sDeployment(activeClusterId!, data),
    onSuccess: (res) => {
      message.success((res as any).data?.msg || (res as any).msg);
      queryClient.invalidateQueries({ queryKey: ['k8s', activeClusterId, 'deployments'] });
    },
  });

  /** @description YAML 更新：直接下发资源定义变更至 API Server */
  const yamlUpdateMutation = useMutation({
    mutationFn: (data: { yaml: string }) => updateK8sYaml(activeClusterId!, data),
    onSuccess: (res) => {
      message.success((res as any).data?.msg || (res as any).msg);
      setIsYamlModalVisible(false);
      // YAML 更新可能影响多种资源，全量失效该集群下的 K8s 资源缓存
      queryClient.invalidateQueries({ queryKey: ['k8s', activeClusterId] });
    },
  });

  /** @description 远程命令执行：在 Pod 内部容器中执行命令 */
  const shellExecMutation = useMutation({
    mutationFn: (data: { namespace: string; pod_name: string; command: string; container?: string }) =>
      execK8sPodCommand(activeClusterId!, data),
    onSuccess: (res) => {
      setShellOutput((res as any).data?.output || (res as any).output || t('k8s.shellExecNoOutput'));
    },
    onError: (err: any) => {
      message.error(`${t('k8s.shellExecFailed')}: ${err.response?.data?.error || err.message}`);
    },
  });

  /** @description 强制删除 Pod：通常用于清理卡死的实例 */
  const deletePodMutation = useMutation({
    mutationFn: (data: { namespace: string; name: string }) => deleteK8sPod(activeClusterId!, data),
    onSuccess: (res) => {
      message.success((res as any).data?.msg || (res as any).msg);
      queryClient.invalidateQueries({ queryKey: ['k8s', activeClusterId, 'pods'] });
    },
    onError: (err: any) => {
      message.error(`${t('k8s.deletePodFailed')}: ${err.response?.data?.error || err.message}`);
    }
  });

  /**
   * @section 数据拉取逻辑 (Fetch Functions)
   */

  /**
   * @description 获取指定资源的 YAML 定义
   * @param type 资源类型 node|pod|deployment|service
   */
  const fetchYaml = async (type: string, name: string, namespace?: string) => {
    if (!activeClusterId) return;
    setYamlLoading(true);
    try {
      const res = await getK8sYaml(activeClusterId, { type, name, namespace });
      setYamlContent((res as any).data?.yaml || (res as any).yaml);
      setYamlTarget({ type, name, namespace });
      setIsYamlModalVisible(true);
    } catch (err: any) {
      message.error(`${t('k8s.yamlFetchFailed')}: ${err.response?.data?.error || err.message}`);
    } finally {
      setYamlLoading(false);
    }
  };

  /** @description 命令执行触发器 */
  const handleShellExec = () => {
    if (!shellTarget || !shellCommand) return;
    shellExecMutation.mutate({
      namespace: shellTarget.namespace,
      pod_name: shellTarget.name,
      command: shellCommand,
    });
  };

  /** @description 获取 Pod 实时滚动日志 */
  const fetchLogs = async (pod: any) => {
    if (!activeClusterId) return;
    setLogsLoading(true);
    try {
      const res = await getK8sPodLogs(activeClusterId, {
        namespace: pod.namespace,
        pod_name: pod.name,
        tail_lines: 500,
      });
      setPodLogs((res as any).data?.logs || (res as any).logs);
      setLogPod(pod);
      setIsLogModalVisible(true);
    } catch (err: any) {
      message.error(`${t('k8s.logsFetchFailed')}: ${err.response?.data?.error || err.message}`);
    } finally {
      setLogsLoading(false);
    }
  };

  /**
   * @section React Query 数据查询
   */
  const { data: clustersData, isLoading: clustersLoading } = useQuery({
    queryKey: ['k8s', 'clusters'],
    queryFn: () => getK8sClusters({ page: 1, size: 100 }),
  });

  const { data: namespacesData } = useQuery({
    queryKey: ['k8s', activeClusterId, 'namespaces'],
    queryFn: () => getK8sNamespaces(activeClusterId!),
    enabled: !!activeClusterId && isDetailVisible,
  });

  const { data: nodesData, isLoading: nodesLoading } = useQuery({
    queryKey: ['k8s', activeClusterId, 'nodes'],
    queryFn: () => getK8sNodes(activeClusterId!),
    enabled: !!activeClusterId && isDetailVisible,
  });

  const { data: podsData, isLoading: podsLoading } = useQuery({
    queryKey: ['k8s', activeClusterId, 'pods', activeNamespace],
    queryFn: () => getK8sPods(activeClusterId!, { namespace: activeNamespace }),
    enabled: !!activeClusterId && isDetailVisible,
  });

  const { data: deploymentsData, isLoading: deploymentsLoading } = useQuery({
    queryKey: ['k8s', activeClusterId, 'deployments', activeNamespace],
    queryFn: () => getK8sDeployments(activeClusterId!, { namespace: activeNamespace }),
    enabled: !!activeClusterId && isDetailVisible,
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['k8s', activeClusterId, 'services', activeNamespace],
    queryFn: () => getK8sServices(activeClusterId!, { namespace: activeNamespace }),
    enabled: !!activeClusterId && isDetailVisible,
  });

  /**
   * @section 集群增删改逻辑
   */
  const createMutation = useMutation({
    mutationFn: (data: any) => createK8sCluster(data),
    onSuccess: () => {
      message.success(t('k8s.clusterAddSuccess'));
      setIsModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['k8s', 'clusters'] });
    },
    onError: (err: any) => {
      message.error(`${t('k8s.clusterAddFailed')}: ${err.message || 'Unknown error'}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => request.put(`/k8s/${id}/`, data),
    onSuccess: () => {
      message.success(t('k8s.clusterUpdateSuccess'));
      setIsModalVisible(false);
      setSelectedCluster(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['k8s', 'clusters'] });
    },
    onError: (err: any) => {
      message.error(`${t('k8s.clusterUpdateFailed')}: ${err.message || 'Unknown error'}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteK8sCluster(id),
    onSuccess: () => {
      message.success(t('k8s.clusterDeleted'));
      queryClient.invalidateQueries({ queryKey: ['k8s', 'clusters'] });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: number) => verifyK8sCluster(id),
    onSuccess: (data) => {
      message.success(t('k8s.connectionVerifySuccess', { version: data.version }));
      queryClient.invalidateQueries({ queryKey: ['k8s', 'clusters'] });
    },
    onError: (err: any) => {
      message.error(`${t('k8s.connectionVerifyFailed')}: ${err.response?.data?.error || err.message}`);
      queryClient.invalidateQueries({ queryKey: ['k8s', 'clusters'] });
    },
  });

  const handleSubmit = (values: any) => {
    if (selectedCluster) {
      updateMutation.mutate({ id: selectedCluster.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const showEdit = (cluster: K8sResource) => {
    setSelectedCluster(cluster);
    form.setFieldsValue({
      name: cluster.name,
      auth_type: cluster.auth_type,
      api_server: cluster.api_server,
    });
    setIsModalVisible(true);
  };

  /** @description 开启资源详情视角，并初始化 Zustand 状态 */
  const showDetail = (cluster: K8sResource) => {
    setSelectedCluster(cluster);
    setActiveClusterId(cluster.id);
    setActiveNamespace(undefined);
    setIsDetailVisible(true);
  };

  const columns = [
    {
      title: t('k8s.clusterName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <ClusterOutlined style={{ color: token.colorPrimary }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: t('k8s.authType'),
      dataIndex: 'auth_type',
      key: 'auth_type',
      render: (type: string) => (
        <Tag color={type === 'kubeconfig' ? 'blue' : 'green'}>
          {type === 'kubeconfig' ? 'Kubeconfig' : 'Token'}
        </Tag>
      ),
    },
    {
      title: t('k8s.apiServer'),
      dataIndex: 'api_server',
      key: 'api_server',
      render: (text: string) => text || '-',
    },
    {
      title: t('k8s.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        let text = t('k8s.unknown');
        if (status === 'connected') {
          color = 'success';
          text = t('k8s.connected');
        } else if (status === 'failed') {
          color = 'error';
          text = t('k8s.connectionFailed');
        } else if (status === 'pending') {
          color = 'processing';
          text = t('k8s.pendingVerify');
        }
        return <Badge status={color as any} text={text} />;
      },
    },
    {
      title: t('k8s.k8sVersion'),
      dataIndex: 'version',
      key: 'version',
      render: (version: string) => <Tag icon={<ApiOutlined style={{ color: token.colorPrimary }} />}>{version || 'N/A'}</Tag>,
    }
  ];

  const nodeColumns = [
    { title: t('k8s.nodeName'), dataIndex: 'name', key: 'name' },
    {
      title: t('k8s.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={status === 'Ready' ? 'success' : 'error'}>{status}</Tag>,
    },
    {
      title: t('k8s.role'),
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => roles.map((r) => <Tag key={r}>{r}</Tag>),
    },
    { title: t('k8s.ipAddress'), dataIndex: 'internal_ip', key: 'internal_ip' },
    {
      title: t('k8s.action'),
      key: 'action',
      render: (_: any, record: any) => (
        <Button
          type="link"
          size="small"
          icon={<CodeOutlined />}
          onClick={() => fetchYaml('node', record.name)}
          loading={yamlLoading && yamlTarget?.name === record.name && yamlTarget?.type === 'node'}
        >
          {t('k8s.yaml')}
        </Button>
      ),
    },
  ];

  const podColumns = [
    { title: t('k8s.podName'), dataIndex: 'name', key: 'name' },
    { title: t('k8s.namespace'), dataIndex: 'namespace', key: 'namespace' },
    {
      title: t('k8s.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'Running' ? 'success' : status === 'Pending' ? 'warning' : 'error'}>
          {status}
        </Tag>
      ),
    },
    { title: t('k8s.restartCount'), dataIndex: 'restarts', key: 'restarts' },
    {
      title: t('k8s.action'),
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => fetchLogs(record)}
            loading={logsLoading && logPod?.name === record.name}
          >
            {t('k8s.logs')}
          </Button>

          { hasPermission('k8s:cluster:pod_exec') && (
          <Button
            type="link"
            size="small"
            icon={<ConsoleSqlOutlined />}
            onClick={() => {
              setShellTarget(record);
              setShellOutput('');
              setIsShellModalVisible(true);
            }}
          >
            {t('k8s.terminal')}
          </Button>
          )}

          { hasPermission('k8s:cluster:yaml_list') && (
              <Button
                type="link"
                size="small"
                icon={<CodeOutlined />}
                onClick={() => fetchYaml('pod', record.name, record.namespace)}
                loading={yamlLoading && yamlTarget?.name === record.name && yamlTarget?.type === 'pod'}
              >
                {t('k8s.yaml')}
              </Button>
          )}

          { hasPermission('k8s:cluster:pod_delete') && (
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  modal.confirm({
                    title: t('k8s.confirmDeletePod'),
                    content: t('k8s.confirmDeletePodContent', { name: record.name }),
                    okText: t('k8s.confirmDelete'),
                    cancelText: t('k8s.cancel'),
                    onOk: () => deletePodMutation.mutate({ namespace: record.namespace, name: record.name }),
                  });
                }}
                loading={deletePodMutation.isPending && (deletePodMutation.variables as any)?.name === record.name}
              >
                {t('k8s.delete')}
              </Button>
          )}
        </Space>
      ),
    },
  ];

  const deploymentColumns = [
    { title: t('k8s.name'), dataIndex: 'name', key: 'name' },
    { title: t('k8s.namespace'), dataIndex: 'namespace', key: 'namespace' },
    { title: t('k8s.instances'), dataIndex: 'replicas', key: 'replicas' },
    {
      title: t('k8s.action'),
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          { hasPermission('k8s:cluster:scale_deployment') && (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setScaleDeployment(record);
              const current = parseInt(record.replicas.split('/')[1]);
              setScaleReplicas(current);
              setIsScaleModalVisible(true);
            }}
          >
            {t('k8s.scale')}
          </Button>
              )}

          { hasPermission('k8s:cluster:restart_deployment') && (
          <Button
            type="link"
            size="small"
            icon={<SyncOutlined />}
            onClick={() => {
              modal.confirm({
                title: t('k8s.restartConfirm'),
                content: t('k8s.restartConfirmContent', { name: record.name }),
                onOk: () => restartMutation.mutate({ namespace: record.namespace, name: record.name }),
              });
            }}
            loading={restartMutation.isPending && restartMutation.variables?.name === record.name}
          >
            {t('k8s.restart')}
          </Button>
              )}

          { hasPermission('k8s:cluster:yaml_list') && (
          <Button
            type="link"
            size="small"
            icon={<CodeOutlined />}
            onClick={() => fetchYaml('deployment', record.name, record.namespace)}
            loading={yamlLoading && yamlTarget?.name === record.name && yamlTarget?.type === 'deployment'}
          >
            {t('k8s.yaml')}
          </Button>
              )}
        </Space>
      ),
    },
  ];

  const serviceColumns = [
    { title: t('k8s.name'), dataIndex: 'name', key: 'name' },
    { title: t('k8s.namespace'), dataIndex: 'namespace', key: 'namespace' },
    { title: t('k8s.serviceType'), dataIndex: 'type', key: 'type' },
    {
      title: t('k8s.action'),
      key: 'action',
      render: (_: any, record: any) => (
        <Button
          type="link"
          size="small"
          icon={<CodeOutlined />}
          onClick={() => fetchYaml('service', record.name, record.namespace)}
          loading={yamlLoading && yamlTarget?.name === record.name && yamlTarget?.type === 'service'}
        >
          {t('k8s.yaml')}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ background: token.colorBgLayout }} className="p-6 min-h-full">
      <Card
        className="border-none shadow-sm"
        title={
          <Space>
            <CloudServerOutlined style={{ color: token.colorPrimary }} />
            <Title level={4} style={{ margin: 0 }}>
              {t('k8s.title')}
            </Title>
          </Space>
        }
        extra={
            hasPermission('k8s:cluster:add') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setSelectedCluster(null);
            form.resetFields();
            setIsModalVisible(true);
          }}>
            {t('k8s.connectCluster')}
          </Button>
            )
        }
      >
        <Table
          columns={[
            ...columns,
            {
              title: '操作中心',
              key: 'action',
              className: "text-center",
              render: (_: any, record: K8sResource) => (
                <Space>
                  {hasPermission('k8s:cluster:verify') && (
                  <Tooltip title={t('k8s.verifyConnection')}>
                    <Button
                      type="link"
                      size="small"
                      icon={<PlayCircleOutlined />}
                      onClick={() => verifyMutation.mutate(record.id)}
                      loading={verifyMutation.isPending && verifyMutation.variables === record.id}
                    />
                  </Tooltip>
                      )}

                  {hasPermission('k8s:cluster:resources_view') && (
                  <Tooltip title={t('k8s.manageResources')}>
                    <Button
                      type="link"
                      size="small"
                      icon={<AppstoreOutlined />}
                      onClick={() => showDetail(record)}
                    />
                  </Tooltip>
                      )}

                  {hasPermission('k8s:cluster:edit') && (
                  <Tooltip title={t('k8s.modifyConfig')}>
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => showEdit(record)}
                    />
                  </Tooltip>
                      )}

                  {hasPermission('k8s:cluster:delete') && (
                  <Tooltip title={t('k8s.deleteCluster')}>
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        modal.confirm({
                          title: t('k8s.confirmDelete'),
                          content: t('k8s.confirmDeleteClusterContent', { name: record.name }),
                          onOk: () => deleteMutation.mutate(record.id),
                        });
                      }}
                    />
                  </Tooltip>
                      )}
                </Space>
              ),
            },
          ]}
          dataSource={clustersData?.data || []}
          rowKey="id"
          loading={clustersLoading}
          scroll={{ x: 1200 }}
          pagination={false}
          className="w-full"
        />
      </Card>

      {/* Add/Edit Cluster Modal */}
      <Modal
        title={selectedCluster ? t('k8s.modifyClusterAuth') : t('k8s.connectKubernetes')}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setSelectedCluster(null);
          form.resetFields();
        }}
        footer={null}
        width={isMobile ? '95vw' : 600}
        bodyStyle={{ overflowX: 'auto' }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ auth_type: 'kubeconfig' }}>
          <Form.Item
            name="name"
            label={t('k8s.clusterNameLabel')}
            rules={[{ required: true, message: t('k8s.enterClusterName') }]}
          >
            <Input placeholder={t('k8s.exampleProduction')} />
          </Form.Item>

          <Form.Item
            name="auth_type"
            label={t('k8s.authTypeLabel')}
            rules={[{ required: true }]}
          >
            <Select
              placeholder={t('k8s.selectAuthType')}
              options={[
                { value: 'kubeconfig', label: t('k8s.kubeconfigFile') },
                { value: 'token', label: t('k8s.apiServerToken') },
              ]}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.auth_type !== currentValues.auth_type}
          >
            {({ getFieldValue }) => {
              const authType = getFieldValue('auth_type');
              if (authType === 'kubeconfig') {
                return (
                  <Form.Item
                    name="kubeconfig_content"
                    label={t('k8s.kubeconfigContent')}
                    rules={[{ required: !selectedCluster, message: t('k8s.pasteKubeconfig') }]}
                    extra={selectedCluster ? t('k8s.keepCurrentConfig') : t('k8s.copyKubeconfig')}
                  >
                    <TextArea rows={10} placeholder={t('k8s.pasteKubeconfig')} />
                  </Form.Item>
                );
              } else if (authType === 'token') {
                return (
                  <>
                    <Form.Item
                      name="api_server"
                      label={t('k8s.apiServerAddress')}
                      rules={[{ required: true, message: t('k8s.enterApiServerAddress') }]}
                    >
                      <Input placeholder="https://1.2.3.4:6443" />
                    </Form.Item>
                    <Form.Item
                      name="token"
                      label={t('k8s.authToken')}
                      rules={[{ required: !selectedCluster, message: t('k8s.enterServiceAccountToken') }]}
                      extra={selectedCluster ? t('k8s.keepCurrentToken') : t('k8s.clusterAdminToken')}
                    >
                      <TextArea rows={4} placeholder={t('k8s.enterServiceAccountToken')} />
                    </Form.Item>
                  </>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item name="remark" label={t('k8s.remarkLabel')}>
            <TextArea rows={2} />
          </Form.Item>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>{t('k8s.cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {selectedCluster ? t('k8s.confirmModify') : t('k8s.connectNow')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer/Modal */}
      <Modal
        title={
          <Space>
            <ClusterOutlined style={{ color: token.colorPrimary }} />
            <Text strong style={{ fontSize: '16px' }}>{t('k8s.clusterManagement', { name: selectedCluster?.name })}</Text>
            <Tag color={token.colorPrimary}>{selectedCluster?.version}</Tag>
          </Space>
        }
        open={isDetailVisible}
        onCancel={() => setIsDetailVisible(false)}
        footer={null}
        width={isMobile ? '95vw' : 1100}
        bodyStyle={{ overflowX: 'auto' }}
        className="top-5 custom-modal-premium"
      >
        <div className="flex flex-col gap-6 py-2">
          <div
            style={{ background: token.colorBgLayout, borderColor: token.colorBorderSecondary }}
            className="flex items-center justify-between p-4 rounded-xl border border-solid"
          >
            <div className="flex items-center gap-4">
              <Text strong style={{ fontSize: '12px', color: token.colorTextTertiary }} className="uppercase tracking-wider">
                {t('k8s.namespaceSelect')}
              </Text>
              <Select
                showSearch
                className="w-80 custom-select-premium"
                placeholder={t('k8s.clusterWide')}
                allowClear
                onChange={(val) => setActiveNamespace(val)}
                value={activeNamespace}
                options={namespacesData?.map((ns: string) => ({ label: ns, value: ns }))}
                popupClassName="rounded-xl shadow-xl border-slate-100 dark:border-slate-700"
              />
            </div>

            <Button
              icon={<ReloadOutlined style={{ color: token.colorPrimary }} />}
              className="hover:scale-105 transition-transform rounded-xl h-10 px-6 font-medium border-slate-200"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['k8s', activeClusterId] });
              }}
            >
              {t('k8s.refreshAllResources')}
            </Button>
          </div>

          <Tabs
            defaultActiveKey="pods"
            items={[
              {
                key: 'nodes',
                label: (
                  <Space>
                    <DatabaseOutlined />
                    <span>{t('k8s.nodes')}</span>
                  </Space>
                ),
                children: <Table columns={nodeColumns} dataSource={nodesData} rowKey="name" loading={nodesLoading} pagination={{ pageSize: 5 }} />,
              },
              {
                key: 'pods',
                label: (
                  <Space>
                    <PlayCircleOutlined />
                    <span>{t('k8s.pods')}</span>
                  </Space>
                ),
                children: <Table columns={podColumns} dataSource={podsData} rowKey="name" loading={podsLoading} pagination={{ pageSize: 10 }} />,
              },
              {
                key: 'deployments',
                label: (
                  <Space>
                    <AppstoreOutlined />
                    <span>{t('k8s.deployments')}</span>
                  </Space>
                ),
                children: <Table columns={deploymentColumns} dataSource={deploymentsData} rowKey="name" loading={deploymentsLoading} pagination={{ pageSize: 10 }} />,
              },
              {
                key: 'services',
                label: (
                  <Space>
                    <ApiOutlined />
                    <span>{t('k8s.services')}</span>
                  </Space>
                ),
                children: <Table columns={serviceColumns} dataSource={servicesData} rowKey="name" loading={servicesLoading} pagination={{ pageSize: 10 }} />,
              },
            ]}
          />
        </div>
      </Modal>

      {/* Deployment Scale Modal */}
      <Modal
        title={t('k8s.scaleModalTitle', { name: scaleDeployment?.name })}
        open={isScaleModalVisible}
        onCancel={() => setIsScaleModalVisible(false)}
        onOk={() => scaleMutation.mutate({
          namespace: scaleDeployment?.namespace,
          name: scaleDeployment?.name,
          replicas: scaleReplicas
        })}
        okText={t('k8s.confirmAdjust')}
        confirmLoading={scaleMutation.isPending}
      >
        <div className="py-5 flex items-center gap-4">
          <Text className="font-medium">{t('k8s.adjustReplicaCount')}</Text>
          <InputNumber
            min={0}
            max={100}
            value={scaleReplicas}
            onChange={(val) => setScaleReplicas(val || 0)}
            autoFocus
            className="w-32"
          />
        </div>
      </Modal>

      {/* Pod Logs Modal */}
      <Modal
        title={
          <div className="flex items-center justify-between pr-8">
            <Space>
              <FileTextOutlined style={{ color: token.colorPrimary }} />
              <span>{t('k8s.podLogs', { name: logPod?.name })}</span>
            </Space>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => fetchLogs(logPod)}
              loading={logsLoading}
            >
              {t('k8s.refresh')}
            </Button>
          </div>
        }
        open={isLogModalVisible}
        onCancel={() => setIsLogModalVisible(false)}
        footer={null}
        width={isMobile ? '95vw' : 1000}
        bodyStyle={{ overflowX: 'auto' }}
        className="top-5"
      >
        <pre
          style={{ background: token.colorBgLayout, borderColor: token.colorBorderSecondary, color: token.colorText }}
          className="p-4 rounded-lg border border-solid overflow-auto max-h-150 text-xs leading-relaxed font-mono"
        >
          {podLogs || t('k8s.noLogsOutput')}
        </pre>
      </Modal>

      {/* YAML Editor Modal */}
      <Modal
        title={
          <Space>
            <CodeOutlined style={{ color: token.colorPrimary }} />
            <span>{t('k8s.yamlEditor', { action: hasPermission('k8s:cluster:update_yaml') ? t('k8s.edit') : t('k8s.view'), name: yamlTarget?.name, type: yamlTarget?.type })}</span>
          </Space>
        }
        open={isYamlModalVisible}
        onCancel={() => setIsYamlModalVisible(false)}
        onOk={() => yamlUpdateMutation.mutate({ yaml: yamlContent })}
        okText={t('k8s.saveAndApply')}
        cancelText={hasPermission('k8s:cluster:update_yaml') ? t('k8s.cancel') : t('k8s.close')}
        okButtonProps={{
          style: hasPermission('k8s:cluster:update_yaml') ? {} : { display: 'none' }
        }}
        confirmLoading={yamlUpdateMutation.isPending}
        width={isMobile ? '95vw' : 900}
        bodyStyle={{ overflowX: 'auto' }}
        className="top-5"
      >
        <TextArea
          value={yamlContent}
          onChange={(e) => setYamlContent(e.target.value)}
          rows={25}
          readOnly={!hasPermission('k8s:cluster:update_yaml')}
          style={{ background: token.colorBgLayout, borderColor: token.colorBorderSecondary, color: token.colorText }}
          className="font-mono text-xs p-4 rounded-lg"
        />
      </Modal>

      {/* WebShell Modal */}
      <Modal
        title={
          <Space>
            <ConsoleSqlOutlined style={{ color: token.colorPrimary }} />
            <span>{t('k8s.containerTerminal', { name: shellTarget?.name })}</span>
          </Space>
        }
        open={isShellModalVisible}
        onCancel={() => setIsShellModalVisible(false)}
        footer={null}
        width={isMobile ? '95vw' : 900}
        bodyStyle={{ overflowX: 'auto' }}
        className="top-5"
      >
        <div className="mb-4 mt-3">
          <Space.Compact className="w-full">
            <Input
              value={shellCommand}
              onChange={(e) => setShellCommand(e.target.value)}
              onPressEnter={handleShellExec}
              placeholder={t('k8s.enterCommand')}
            />
            {hasPermission('k8s:cluster:pod_exec') && (
            <Button type="primary" onClick={handleShellExec} loading={shellExecMutation.isPending} icon={<PlayCircleOutlined />}>
              {t('k8s.execute')}
            </Button>
                )}
          </Space.Compact>
        </div>
        <div
          style={{ background: token.colorBgLayout, borderColor: token.colorBorderSecondary, color: token.colorText }}
          className="p-4 border border-solid rounded-lg font-mono text-xs min-h-100 max-h-125 overflow-auto whitespace-pre-wrap leading-relaxed shadow-inner"
        >
          {shellExecMutation.isPending ? t('k8s.commandExecuting') : shellOutput || t('k8s.waitingForCommand')}
        </div>
      </Modal>
    </div>
  );
};

export default K8sCenter;
