import React, {useState, useRef, useCallback, useEffect, useMemo} from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Connection,
  Edge,
  Node
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
    Layout,
    Typography,
    Space,
    Button,
    theme,
    Drawer,
    Form,
    Input,
    App,
    Select,
    Card,
    InputNumber,
    Flex
} from 'antd';
import { 
  PlayCircleOutlined, 
  CodeOutlined, 
  CloudServerOutlined, 
  ApiOutlined, 
  SaveOutlined,
  GithubOutlined,
  ContainerOutlined,
  ArrowLeftOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getAnsibleTasks } from '../../api/tasks';
import { getK8sClusters, getHelmLocalCharts } from '../../api/k8s';
import { createPipeline, updatePipeline, getPipeline, getCIEnvironments, executePipeline } from '../../api/pipeline';
import { getRegistries } from '../../api/registry';
import { getCredentials } from '../../api/credential';
import useDesignerStore from '../../store/useDesignerStore';
import useAppStore from '../../store/useAppStore';

import AnsibleNode from './nodes/AnsibleNode';
import K8sNode from './nodes/K8sNode';
import HttpNode from './nodes/HttpNode';
import GitNode from './nodes/GitNode';
import BuildNode from './nodes/BuildNode';
import KanikoNode from './nodes/KanikoNode';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;

const nodeTypes = {
  ansible: AnsibleNode,
  k8s_deploy: K8sNode,
  http_webhook: HttpNode,
  git_clone: GitNode,
  docker_build: BuildNode,
  kaniko_build: KanikoNode,
};

// 显式定义全局单例，防止 React Flow 引用抖动
const edgeTypes = {};

let id = 0;
const getId = () => `dndnode_${id++}`;

/**
 * @name DesignerCore
 * @description 流水线设计器核心逻辑层，支持 DnD 拖拽、DAG 连线、节点参数表单化配置
 */
const DesignerCore = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  const { nodes, setNodes, edges, setEdges } = useDesignerStore();
  const [nodesState, setNodesState, onNodesChange] = useNodesState([]);
  const [edgesState, setEdgesState, onEdgesChange] = useEdgesState([]);
  
  useEffect(() => {
    setNodesState(nodes);
  }, [nodes, setNodesState]);

  useEffect(() => {
    setEdgesState(edges);
  }, [edges, setEdgesState]);

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const { token } = theme.useToken();
  const { modal, message } = App.useApp();
  const { token: authToken, hasPermission } = useAppStore();

  const { data: ansibleTasksData } = useQuery({
    queryKey: ['ansibleTasksPipeline'],
    queryFn: () => getAnsibleTasks({ page_size: 200 }),
    enabled: !!authToken && hasPermission('pipeline:template:view'),
  });
  
  const { data: clustersData } = useQuery({
    queryKey: ['k8sClustersPipeline'],
    queryFn: () => getK8sClusters({ page_size: 200 }),
    enabled: !!authToken && hasPermission('pipeline:template:view'),
  });

  const { data: localChartsData } = useQuery({
    queryKey: ['k8sLocalChartsPipeline'],
    queryFn: () => getHelmLocalCharts(),
    enabled: !!authToken && hasPermission('pipeline:template:view'),
  });

  const { data: ciEnvsData } = useQuery({
    queryKey: ['ciEnvironmentsPipeline'],
    queryFn: () => getCIEnvironments(),
    enabled: !!authToken && hasPermission('pipeline:template:view'),
  });

  const { data: registriesData } = useQuery({
    queryKey: ['registriesPipeline'],
    queryFn: () => getRegistries({ page_size: 200 }),
    enabled: !!authToken && hasPermission('pipeline:template:view'),
  });

  const { data: credentialsData } = useQuery({
    queryKey: ['credentialsPipeline'],
    queryFn: () => getCredentials({ page_size: 200 }),
    enabled: !!authToken && hasPermission('pipeline:template:view'),
  });

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [form] = Form.useForm();
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pipelineId = searchParams.get('id');
  const [pipelineInfo, setPipelineInfo] = useState<any>(null);

  useEffect(() => {
    if (pipelineId && reactFlowInstance) {
        getPipeline(Number(pipelineId)).then((res) => {
          const data = res.data || res;
          setPipelineInfo(data);
          if (data.graph_data) {
            setNodes(data.graph_data.nodes || []);
            setEdges(data.graph_data.edges || []);
            setTimeout(() => {
              if (data.graph_data.viewport) {
                reactFlowInstance.setViewport(data.graph_data.viewport);
              } else reactFlowInstance.fitView();
            }, 10);
          }
        });
    }
  }, [pipelineId, reactFlowInstance, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection | Edge) => setEdgesState((eds) => addEdge(params, eds)), [setEdgesState]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: `${type} 节点` },
      };

      const updatedNodes = [...nodes, newNode];
      setNodesState(updatedNodes);
      setNodes(updatedNodes);
    },
    [reactFlowInstance, nodes, setNodes, setNodesState]
  );

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    form.resetFields(); // 必须先重置表单，使得 initialValue 能够生效
    form.setFieldsValue({
      label: node.data?.label,
      ...node.data
    });
    setDrawerVisible(true);
  };

  const onDrawerSave = () => {
    form.validateFields().then((values) => {
      const updatedNodes = nodesState.map((nds) => {
        if (nds.id === selectedNode?.id) {
          return { ...nds, data: { ...nds.data, ...values } };
        }
        return nds;
      });
      setNodesState(updatedNodes);
      setNodes(updatedNodes);
      setDrawerVisible(false);
      message.success('节点参数已暂存');
    });
  };

  const handleSave = async () => {
    modal.confirm({
        title: '流水线设置',
        width: 500,
        content: (
            <div className="mt-4 flex flex-col gap-4">
                <div>
                   <Text type="secondary" className="text-xs mb-1 block">流水线唯一标识名称 (Blueprint Name)</Text>
                   <Input id="pipeline-name-input" defaultValue={pipelineInfo?.name} placeholder="例如: 生产环境自动化部署" className="rounded-lg h-10" />
                </div>
                <div>
                   <Text type="secondary" className="text-xs mb-1 block">定时调度表达式 (Cron Expression, 可选)</Text>
                   <Input id="pipeline-cron-input" defaultValue={pipelineInfo?.schedule_cron} placeholder="如: 0 0 * * * (每天零点)" className="font-mono rounded-lg h-10" />
                </div>
                <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                    <Text type="secondary" className="text-[11px] block">💡 Cron 格式参考: 分 时 日 月 周。留空则表示仅手动触发。</Text>
                </div>
            </div>
        ),
        onOk: () => {
            const nameInput = document.getElementById('pipeline-name-input') as HTMLInputElement;
            const cronInput = document.getElementById('pipeline-cron-input') as HTMLInputElement;
            if (!nameInput.value) { message.warning('必须输入名称'); return Promise.reject(); }
            submitPipeline(nameInput.value, cronInput.value);
        }
    });
  };

  const submitPipeline = async (name: string, schedule_cron?: string) => {
    const graphData = {
        nodes: nodesState,
        edges: edgesState,
        viewport: reactFlowInstance.getViewport(),
    };
    const payload = { 
        name, 
        schedule_cron: schedule_cron || null,
        graph_data: graphData,
        is_active: true // 默认激活
    };
    try {
        if (pipelineId) await updatePipeline(Number(pipelineId), payload);
        else {
            const res = await createPipeline(payload);
            const newId = res.id || res.data?.id;
            navigate(`/v1/pipeline/designer?id=${newId}`);
        }
        message.success('流水线与调度策略已成功同步至引擎');
    } catch(e: any) { message.error(e.message); }
  };

  const handleRun = async () => {
      if (!pipelineId) { message.warning('请先保存流水线'); return; }
      try {
          const res = await executePipeline(Number(pipelineId));
          if (res.code === 202 || res.status === 'pending_approval') {
                modal.warning({
                    title: '操作需要审批',
                    content: (
                        <div className="mt-2">
                            <p>{res.message || '系统安全策略保护中。'}</p>
                        </div>
                    ),
                    okText: '好的'
                });
                return;
          }
          const runId = res.run_id || res.data?.run_id;
          if (runId) navigate(`/v1/pipeline/runs/${runId}`);
      } catch (e: any) { message.error(e.message); }
  };

  const nodeTemplates = useMemo(() => [
          { type: 'ansible', label: 'Ansible 任务', icon: <CodeOutlined />, description: '执行 Ansible Playbook' },
          { type: 'git_clone', label: 'Git 源码克隆', icon: <GithubOutlined />, description: '代码拉取' },
          { type: 'docker_build', label: 'Docker 构建', icon: <ContainerOutlined />, description: '容器镜像编译' },
          { type: 'kaniko_build', label: 'Kaniko 构建', icon: <ContainerOutlined />, description: 'K8s 内部镜像构建' },
          { type: 'k8s_deploy', label: 'K8s 交付', icon: <CloudServerOutlined />, description: '集群部署' },
          { type: 'http_webhook', label: 'HTTP 外部调用', icon: <ApiOutlined />, description: 'Webhook 触发' },
      ], []
  );

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  return (
    <div style={{ background: token.colorBgLayout }} className="h-full w-full flex flex-col overflow-hidden antialiased">
      {/* Header Bar */}
      <header 
        style={{ background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
        className="h-16 px-6 flex items-center justify-between z-10 transition-colors"
      >
        <Space size="middle">
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/v1/pipeline/list')} 
          />
          <div className="flex flex-col">
            <Title level={5} className="m-0!">{pipelineInfo?.name || '新流水线编辑器'}</Title>
            {/*<Text type="secondary" className="text-[10px] uppercase tracking-widest font-bold">*/}
            {/*  {pipelineId ? `BLUEPRINT ID: ${pipelineId}` : 'NEW BLUEPRINT DRAFT'}*/}
            {/*</Text>*/}
          </div>
        </Space>
        <Space>
          {hasPermission('pipeline:template:execute') && <Button icon={<PlayCircleOutlined />} type="primary" onClick={handleRun} disabled={!pipelineId} className="shadow-blue-200">执行</Button>}
          {hasPermission('pipeline:template:edit') && <Button icon={<SaveOutlined />} onClick={handleSave}>保存</Button>}
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/v1/pipeline/list')}>返回</Button>
        </Space>
      </header>

      <Layout className="flex-1 overflow-hidden" style={{ background: 'transparent' }}>
        <Sider 
            width={280} 
            style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}` }}
            className="overflow-y-auto"
        >
            <div className="p-5 flex flex-col gap-4">
                <Flex vertical gap={2}>
                    <Text strong className="text-[16px] uppercase tracking-widest">
                        组件列表
                    </Text>
                    <Text type="secondary" className="text-[12px] uppercase tracking-widest">
                        拖拽组件到画布进行编辑
                    </Text>
                </Flex>


                <div className="flex flex-col gap-3">
                    {nodeTemplates.map((node) => {
                      const colorMap: any = {
                        ansible: '#EE0000', 
                        git_clone: '#1A1D1E', 
                        docker_build: '#2496ED', 
                        kaniko_build: '#F39C12',
                        k8s_deploy: '#326CE5',
                        http_webhook: '#8E44AD'
                      };
                      const nodeColor = colorMap[node.type] || token.colorPrimary;
                      return (
                        <div
                            key={node.type}
                            style={{ 
                                background: token.colorBgContainer, 
                                borderLeft: `4px solid ${nodeColor}`,
                                borderColor: token.colorBorderSecondary 
                            }}
                            className="p-4 border border-solid rounded-xl cursor-grab hover:shadow-lg transition-all group flex items-start gap-3"
                            onDragStart={(event) => onDragStart(event, node.type)}
                            draggable
                        >
                            <div 
                              style={{ color: nodeColor, backgroundColor: `${nodeColor}15` }} 
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform"
                            >
                                {node.icon}
                            </div>
                            <div className="flex flex-col flex-1">
                                <Text strong style={{ color: token.colorText }} className="text-sm">{node.label}</Text>
                                <Text type="secondary" className="text-[10px] mt-0.5 leading-tight">{node.description}</Text>
                            </div>
                        </div>
                      );
                    })}
                </div>
            </div>
        </Sider>
        
        <Content 
            style={{ background: token.colorBgLayout }}
            className="relative"
        >
            <div className="h-full w-full bg-transparent" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodesState}
                    edges={edgesState}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onNodeClick={onNodeClick}

                    // --- 🚀 性能压榨核心配置 ---
                    onlyRenderVisibleElements={true}  // 开启视野外元素过滤
                    minZoom={0.2}                     // 限制了最小缩放，防止缩得太小导致计算量激增
                    maxZoom={2}

                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    className="bg-transparent"
                >
                    <Background gap={32} size={1} color={token.colorBorderSecondary} />
                    <Controls style={{ background: token.colorBgContainer, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <MiniMap style={{ background: token.colorBgContainer, borderColor: token.colorBorderSecondary, borderRadius: '12px' }} />
                </ReactFlow>
            </div>
        </Content>
      </Layout>

      <Drawer
        title={<Space><SettingOutlined className="text-blue-500" /><span>配置节点: {selectedNode?.type}</span></Space>}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        size={450}
        extra={hasPermission('pipeline:template:edit') ? <Button type="primary" size="small" onClick={onDrawerSave}>保存配置</Button> : null}
        className="custom-drawer"
      >
        <Form form={form} layout="vertical" className="px-1 pt-4">
          <Card size="small" title="基础属性" className="mb-5 border-none shadow-sm">
            <Form.Item label="节点标识" name="label">
              <Input placeholder="输入显示在节点上的名称" className="rounded-lg h-10" />
            </Form.Item>
            <Space className="w-full justify-between">
              <Form.Item label="最大重试次数" name="max_retries" initialValue={0} className="w-32 mb-0">
                <InputNumber min={0} max={10} className="w-full h-9 flex items-center" />
              </Form.Item>
              <Form.Item label="重试间隔 (秒)" name="retry_delay" initialValue={10} className="w-32 mb-0">
                <InputNumber min={1} className="w-full h-9 flex items-center" />
              </Form.Item>
            </Space>
          </Card>

          {selectedNode?.type === 'git_clone' && (
            <Card size="small" title="源码配置" className="mb-5 border-none shadow-sm">
              <Form.Item label="仓库地址" name="git_repo" rules={[{ required: true }]}><Input placeholder="https://github.com/..." /></Form.Item>
              <Form.Item label="分支名称" name="git_branch" initialValue="main"><Input /></Form.Item>
              <Form.Item label="身份认证 (SSH 凭据)" name="credential_id">
                <Select
                  placeholder="选择认证凭据 (可选)"
                  allowClear
                  options={credentialsData?.results || credentialsData?.data || []}
                  fieldNames={{ label: 'name', value: 'id' }}
                />
              </Form.Item>
            </Card>
          )}

          {selectedNode?.type === 'docker_build' && (
            <Card size="small" title="编译环境" className="mb-5 border-none shadow-sm">
              <Form.Item label="执行沙箱" name="ci_env_id" rules={[{ required: true }]}>
                <Select
                  placeholder="选择构建环境"
                  options={ciEnvsData?.data || []}
                  fieldNames={{ label: 'name', value: 'id' }}
                />
              </Form.Item>
              <Form.Item label="编译指令" name="build_script" rules={[{ required: true }]}>
                <Input.TextArea rows={4} className="font-mono text-xs" />
              </Form.Item>
            </Card>
          )}

          {selectedNode?.type === 'kaniko_build' && (
            <Card size="small" title="镜像推送" className="mb-5 border-none shadow-sm">
              <Form.Item label="目标仓库" name="registry_id" rules={[{ required: true }]}>
                <Select
                  placeholder="选择仓库"
                  options={registriesData?.data || (registriesData as any)?.results || []}
                  fieldNames={{ label: 'name', value: 'id' }}
                />
              </Form.Item>
              <Form.Item label="镜像名称" name="image_name" rules={[{ required: true }]}><Input placeholder="例如: my-service" /></Form.Item>
              <Form.Item label="镜像标签 (Tag)" name="image_tag" initialValue="latest"><Input placeholder="例如: v1.0.0" /></Form.Item>
              <Form.Item label="Dockerfile" name="dockerfile_path" initialValue="Dockerfile"><Input /></Form.Item>
            </Card>
          )}

          {selectedNode?.type === 'ansible' && (
            <Card size="small" title="Ansible 关联" className="mb-5 border-none shadow-sm">
              <Form.Item label="任务模板" name="ansible_task_id" rules={[{ required: true }]}>
                <Select
                  placeholder="选择任务"
                  options={ansibleTasksData?.data || []}
                  fieldNames={{ label: 'name', value: 'id' }}
                />
              </Form.Item>
            </Card>
          )}

          {selectedNode?.type === 'k8s_deploy' && (
             <>
               <Card size="small" title="K8s 交付" className="mb-5 border-none shadow-sm">
                  <Form.Item label="目标集群" name="k8s_cluster_id" rules={[{required: true}]}>
                    <Select 
                      placeholder="选择集群"
                      options={clustersData?.data || []} 
                      fieldNames={{ label: 'name', value: 'id' }} 
                      showSearch
                    />
                  </Form.Item>
                  <Form.Item label="Release 名称" name="k8s_release_name" rules={[{required: true}]}>
                      <Input placeholder="例如: my-test" />
                  </Form.Item>
                  <Form.Item label="命名空间" name="k8s_namespace" initialValue="default">
                      <Input placeholder="default" />
                  </Form.Item>
               </Card>
               <Card size="small" title="Helm 配置" className="mb-5 border-none shadow-sm">
                  <Form.Item label="本地 Chart" name="k8s_chart_name">
                      <Select
                         placeholder="选择本地 Chart"
                         options={localChartsData || []}
                         fieldNames={{ label: 'name', value: 'id' }}
                         showSearch
                         allowClear
                      />
                  </Form.Item>
                  <Form.Item label="强制执行 (--force)" name="k8s_force" initialValue={false} tooltip="当发生资源冲突时（如 replicas 被其他控制器占用），开启此项将强制覆盖冲突并更新。">
                      <Select options={[{ label: '关闭 (推荐)', value: false }, { label: '开启 (解决冲突)', value: true }]} />
                  </Form.Item>
               </Card>
               <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-dashed border-amber-200 dark:border-amber-700 mb-5">
                   <Text className="text-[11px] text-amber-700 dark:text-amber-500 block leading-relaxed">
                       💡 提示：如果遇到 "conflict occurred" 错误（例如 OpenAPI-Generator 冲突），请开启【强制执行】策略来解决。
                   </Text>
               </div>
             </>
          )}

          {selectedNode?.type === 'http_webhook' && (
             <Card size="small" title="Webhook 配置" className="mb-5 border-none shadow-sm">
                <Form.Item label="URL" name="webhook_url" rules={[{required:true}]}>
                   <Input placeholder="https://..." />
                </Form.Item>
                <Form.Item label="Method" name="webhook_method" initialValue="POST">
                   <Select options={[{label:'POST', value:'POST'}, {label:'GET', value:'GET'}]} />
                </Form.Item>
             </Card>
          )}
        </Form>
      </Drawer>
    </div>
  );
};

export default function PipelineDesigner() {
  return (
    <div className="h-full w-full antialiased">
      <ReactFlowProvider>
        <DesignerCore />
      </ReactFlowProvider>
    </div>
  );
}
