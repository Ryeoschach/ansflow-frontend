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
      setShellOutput((res as any).data?.output || (res as any).output || '命令已执行，但无回显内容');
    },
    onError: (err: any) => {
      message.error(`执行失败: ${err.response?.data?.error || err.message}`);
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
      message.error(`删除失败: ${err.response?.data?.error || err.message}`);
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
      message.error(`YAML 获取失败: ${err.response?.data?.error || err.message}`);
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
      message.error(`日志获取失败: ${err.response?.data?.error || err.message}`);
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
      message.success('集群添加成功');
      setIsModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['k8s', 'clusters'] });
    },
    onError: (err: any) => {
      message.error(`添加失败: ${err.message || '未知错误'}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => request.put(`/k8s/${id}/`, data),
    onSuccess: () => {
      message.success('集群更新成功');
      setIsModalVisible(false);
      setSelectedCluster(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['k8s', 'clusters'] });
    },
    onError: (err: any) => {
      message.error(`更新失败: ${err.message || '未知错误'}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteK8sCluster(id),
    onSuccess: () => {
      message.success('集群已删除');
      queryClient.invalidateQueries({ queryKey: ['k8s', 'clusters'] });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: number) => verifyK8sCluster(id),
    onSuccess: (data) => {
      message.success(`连接验证成功! 版本: ${data.version}`);
      queryClient.invalidateQueries({ queryKey: ['k8s', 'clusters'] });
    },
    onError: (err: any) => {
      message.error(`连接验证失败: ${err.response?.data?.error || err.message}`);
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
      title: '集群名称',
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
      title: '认证方式',
      dataIndex: 'auth_type',
      key: 'auth_type',
      render: (type: string) => (
        <Tag color={type === 'kubeconfig' ? 'blue' : 'green'}>
          {type === 'kubeconfig' ? 'Kubeconfig' : 'Token'}
        </Tag>
      ),
    },
    {
      title: 'API Server',
      dataIndex: 'api_server',
      key: 'api_server',
      render: (text: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        let text = '未知';
        if (status === 'connected') {
          color = 'success';
          text = '连接成功';
        } else if (status === 'failed') {
          color = 'error';
          text = '连接失败';
        } else if (status === 'pending') {
          color = 'processing';
          text = '待验证';
        }
        return <Badge status={color as any} text={text} />;
      },
    },
    {
      title: 'K8s 版本',
      dataIndex: 'version',
      key: 'version',
      render: (version: string) => <Tag icon={<ApiOutlined style={{ color: token.colorPrimary }} />}>{version || 'N/A'}</Tag>,
    }
  ];

  const nodeColumns = [
    { title: '节点名称', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={status === 'Ready' ? 'success' : 'error'}>{status}</Tag>,
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => roles.map((r) => <Tag key={r}>{r}</Tag>),
    },
    { title: 'IP 地址', dataIndex: 'internal_ip', key: 'internal_ip' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button
          type="link"
          size="small"
          icon={<CodeOutlined />}
          onClick={() => fetchYaml('node', record.name)}
          loading={yamlLoading && yamlTarget?.name === record.name && yamlTarget?.type === 'node'}
        >
          YAML
        </Button>
      ),
    },
  ];

  const podColumns = [
    { title: 'Pod 名称', dataIndex: 'name', key: 'name' },
    { title: '命名空间', dataIndex: 'namespace', key: 'namespace' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'Running' ? 'success' : status === 'Pending' ? 'warning' : 'error'}>
          {status}
        </Tag>
      ),
    },
    { title: '重启次数', dataIndex: 'restarts', key: 'restarts' },
    {
      title: '操作',
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
            日志
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
            终端
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
                YAML
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
                    title: '确认删除 Pod',
                    content: `确定要删除 Pod "${record.name}" 吗？如果是由 Deployment/StatefulSet 管理的，它将被自动重建。`,
                    okText: '确认删除',
                    cancelText: '取消',
                    onOk: () => deletePodMutation.mutate({ namespace: record.namespace, name: record.name }),
                  });
                }}
                loading={deletePodMutation.isPending && (deletePodMutation.variables as any)?.name === record.name}
              >
                删除
              </Button>
          )}
        </Space>
      ),
    },
  ];

  const deploymentColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '命名空间', dataIndex: 'namespace', key: 'namespace' },
    { title: '实例 (正在运行/总数)', dataIndex: 'replicas', key: 'replicas' },
    {
      title: '操作',
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
            扩容
          </Button>
              )}

          { hasPermission('k8s:cluster:restart_deployment') && (
          <Button
            type="link"
            size="small"
            icon={<SyncOutlined />}
            onClick={() => {
              modal.confirm({
                title: '重启确认',
                content: `确认要触发 Deployment "${record.name}" 的滚动重启吗？`,
                onOk: () => restartMutation.mutate({ namespace: record.namespace, name: record.name }),
              });
            }}
            loading={restartMutation.isPending && restartMutation.variables?.name === record.name}
          >
            重启
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
            YAML
          </Button>
              )}
        </Space>
      ),
    },
  ];

  const serviceColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '命名空间', dataIndex: 'namespace', key: 'namespace' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button
          type="link"
          size="small"
          icon={<CodeOutlined />}
          onClick={() => fetchYaml('service', record.name, record.namespace)}
          loading={yamlLoading && yamlTarget?.name === record.name && yamlTarget?.type === 'service'}
        >
          YAML
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
              Kubernetes 集群中心
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
            连接集群
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
                  <Tooltip title="验证连接">
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
                  <Tooltip title="管理资源">
                    <Button 
                      type="link" 
                      size="small" 
                      icon={<AppstoreOutlined />} 
                      onClick={() => showDetail(record)} 
                    />
                  </Tooltip>
                      )}

                  {hasPermission('k8s:cluster:edit') && (
                  <Tooltip title="修改配置">
                    <Button 
                      type="link" 
                      size="small" 
                      icon={<EditOutlined />} 
                      onClick={() => showEdit(record)} 
                    />
                  </Tooltip>
                      )}

                  {hasPermission('k8s:cluster:delete') && (
                  <Tooltip title="删除集群">
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        modal.confirm({
                          title: '确认删除',
                          content: `确定要删除集群 "${record.name}" 吗？该操作仅从平台移除连接，不会删除实际集群。`,
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
        title={selectedCluster ? '修改集群认证' : '连接 Kubernetes 集群'}
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
            label="集群名称"
            rules={[{ required: true, message: '请输入集群名称' }]}
          >
            <Input placeholder="例如: Production-Cluster" />
          </Form.Item>

          <Form.Item
            name="auth_type"
            label="认证方式"
            rules={[{ required: true }]}
          >
            <Select 
              placeholder="请选择认证方式"
              options={[
                { value: 'kubeconfig', label: 'Kubeconfig 文件内容' },
                { value: 'token', label: 'API Server Token' },
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
                    label="Kubeconfig 内容"
                    rules={[{ required: !selectedCluster, message: '请粘贴 Kubeconfig 内容' }]}
                    extra={selectedCluster ? '留空表示保持当前配置不变' : '完整复制 ~/.kube/config 及其凭证内容'}
                  >
                    <TextArea rows={10} placeholder="请将 .kube/config 文件内容粘贴到此处" />
                  </Form.Item>
                );
              } else if (authType === 'token') {
                return (
                  <>
                    <Form.Item
                      name="api_server"
                      label="API Server 地址"
                      rules={[{ required: true, message: '请输入 API Server 地址' }]}
                    >
                      <Input placeholder="https://1.2.3.4:6443" />
                    </Form.Item>
                    <Form.Item
                      name="token"
                      label="认证 Token"
                      rules={[{ required: !selectedCluster, message: '请输入 ServiceAccount Token' }]}
                      extra={selectedCluster ? '留空表示保持当前 Token 不变' : '请输入具有集群管理权限的 ServiceAccount Token'}
                    >
                      <TextArea rows={4} placeholder="请输入集群管理 Token" />
                    </Form.Item>
                  </>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item name="remark" label="备注说明">
            <TextArea rows={2} />
          </Form.Item>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {selectedCluster ? '确认修改' : '立即连接'}
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
            <Text strong style={{ fontSize: '16px' }}>集群管理: {selectedCluster?.name}</Text>
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
                命名空间选择
              </Text>
              <Select
                showSearch
                className="w-80 custom-select-premium"
                placeholder="全选命名空间 (Cluster Wide)"
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
                // 标准化后的全量刷新逻辑：失效当前集群下所有 k8s 资源缓存
                queryClient.invalidateQueries({ queryKey: ['k8s', activeClusterId] });
              }}
            >
              全量刷新资源
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
                    <span>节点 (Nodes)</span>
                  </Space>
                ),
                children: <Table columns={nodeColumns} dataSource={nodesData} rowKey="name" loading={nodesLoading} pagination={{ pageSize: 5 }} />,
              },
              {
                key: 'pods',
                label: (
                  <Space>
                    <PlayCircleOutlined />
                    <span>容器组 (Pods)</span>
                  </Space>
                ),
                children: <Table columns={podColumns} dataSource={podsData} rowKey="name" loading={podsLoading} pagination={{ pageSize: 10 }} />,
              },
              {
                key: 'deployments',
                label: (
                  <Space>
                    <AppstoreOutlined />
                    <span>无状态服务 (Deployments)</span>
                  </Space>
                ),
                children: <Table columns={deploymentColumns} dataSource={deploymentsData} rowKey="name" loading={deploymentsLoading} pagination={{ pageSize: 10 }} />,
              },
              {
                key: 'services',
                label: (
                  <Space>
                    <ApiOutlined />
                    <span>网络服务 (Services)</span>
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
        title={`扩缩容: ${scaleDeployment?.name}`}
        open={isScaleModalVisible}
        onCancel={() => setIsScaleModalVisible(false)}
        onOk={() => scaleMutation.mutate({
          namespace: scaleDeployment?.namespace,
          name: scaleDeployment?.name,
          replicas: scaleReplicas
        })}
        okText="确认调整"
        confirmLoading={scaleMutation.isPending}
      >
        <div className="py-5 flex items-center gap-4">
          <Text className="font-medium">调整副本数为:</Text>
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
              <span>Pod 日志: {logPod?.name}</span>
            </Space>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => fetchLogs(logPod)}
              loading={logsLoading}
            >
              刷新
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
          {podLogs || '暂无日志输出...'}
        </pre>
      </Modal>

      {/* YAML Editor Modal */}
      <Modal
        title={
          <Space>
            <CodeOutlined style={{ color: token.colorPrimary }} />
            <span>YAML {hasPermission('k8s:cluster:update_yaml') ? '编辑' : '查看'}: {yamlTarget?.name} ({yamlTarget?.type})</span>
          </Space>
        }
        open={isYamlModalVisible}
        onCancel={() => setIsYamlModalVisible(false)}
        onOk={() => yamlUpdateMutation.mutate({ yaml: yamlContent })}
        okText="保存并应用"
        cancelText={hasPermission('k8s:cluster:update_yaml') ? "取消" : "关闭"}
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
            <span>容器终端: {shellTarget?.name}</span>
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
              // addonBefore="Command"
              value={shellCommand}
              onChange={(e) => setShellCommand(e.target.value)}
              onPressEnter={handleShellExec}
              placeholder="请输入要在容器内执行的命令..."
            />
            {hasPermission('k8s:cluster:pod_exec') && (
            <Button type="primary" onClick={handleShellExec} loading={shellExecMutation.isPending} icon={<PlayCircleOutlined />}>
              执行
            </Button>
                )}
          </Space.Compact>
        </div>
        <div 
          style={{ background: token.colorBgLayout, borderColor: token.colorBorderSecondary, color: token.colorText }}
          className="p-4 border border-solid rounded-lg font-mono text-xs min-h-100 max-h-125 overflow-auto whitespace-pre-wrap leading-relaxed shadow-inner"
        >
          {shellExecMutation.isPending ? '正在执行命令并等待响应...' : shellOutput || '等待输入命令...'}
        </div>
      </Modal>
    </div>
  );
};

export default K8sCenter;
