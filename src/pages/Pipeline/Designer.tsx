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
    Flex,
    Checkbox,
    Divider
} from 'antd';
import {
  PlayCircleOutlined,
  CodeOutlined,
  CloudServerOutlined,
  SaveOutlined,
  GithubOutlined,
  ContainerOutlined,
  ArrowLeftOutlined,
  SettingOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  ApiOutlined
} from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
  import { useTranslation } from 'react-i18next';

import { getAnsibleTasks } from '../../api/tasks';
import { getK8sClusters, getHelmLocalCharts } from '../../api/k8s';
import { createPipeline, updatePipeline, getPipeline, getCIEnvironments, executePipeline } from '../../api/pipeline';
import { bindHealingPipeline } from '../../api/sre';
import { generatePipeline, refinePipeline, suggestNodeParams, getAIModels, getCurrentAIConfig, explainPipeline } from '../../api/ai';
import { getRegistries } from '../../api/registry';
import { getCredentials } from '../../api/credential';
import useDesignerStore from '../../store/useDesignerStore';
import useAppStore from '../../store/useAppStore';
import { useBreakpoint } from '@/utils/useBreakpoint';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  const { t } = useTranslation();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const { nodes, setNodes, edges, setEdges, sourceAlertId, setSourceAlertId } = useDesignerStore();
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

  // AI 编排状态
  const [aiPrompt, setAiPrompt] = useState('');
  const [llmModels, setLlmModels] = useState<any[]>([]);
  const [selectedLLMId, setSelectedLLMId] = useState<number | undefined>(undefined);
  const [isNodeAILoading, setIsNodeAILoading] = useState(false);

  useEffect(() => {
    if (authToken) {
      getAIModels({ model_type: 'llm' }).then(res => {
        const models = Array.isArray(res) ? res : ((res as any).data || (res as any).results || []);
        setLlmModels(models);
      });
      getCurrentAIConfig().then(config => {
        if (config && config.default_llm) setSelectedLLMId(config.default_llm);
      });
    }
  }, [authToken]);

  const handleNodeAI = async () => {
    if (!selectedNode) return;
    setIsNodeAILoading(true);
    try {
      const res = await suggestNodeParams({
        type: selectedNode.type!,
        data: form.getFieldsValue(),
        context: nodes, // 提供全量节点作为上下文
        llm_id: selectedLLMId
      });
      form.setFieldsValue(res);
      message.success('AI 已为您推荐配置参数');
    } catch (e: any) {
      message.error(`AI 辅助失败: ${e.message || '未知错误'}`);
    } finally {
      setIsNodeAILoading(false);
    }
  };

  const aiMutation = useMutation({
    mutationFn: async (prompt: string) => {
      // 核心逻辑：如果画布已有节点，走“修正”流程；否则走“生成”流程
      if (nodes.length > 0) {
        return refinePipeline({
          prompt,
          nodes,
          edges,
          llm_id: selectedLLMId
        });
      }
      return generatePipeline(prompt, selectedLLMId);
    },
    onSuccess: (data) => {
      if (data.nodes) {
        // 安全补丁：确保 AI 返回的节点具有 ReactFlow 所需的 position 和 data
        const safeNodes = data.nodes.map((node: any, idx: number) => ({
          ...node,
          id: String(node.id || `ai_node_${idx}`),
          position: {
            x: typeof node.position?.x === 'number' ? node.position.x : idx * 300,
            y: typeof node.position?.y === 'number' ? node.position.y : 100
          },
          data: {
            ...node.data,
            label: node.data?.label || node.label || `AI 节点 ${idx + 1}`
          }
        }));
        
        setNodes(safeNodes);
        setEdges(data.edges || []);
        message.success(nodes.length > 0 ? '流水线已按指令优化' : '流水线已生成');
        setAiPrompt('');
      }
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || 'AI 编排失败');
    }
  });

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
      message.success(t('pipelineDesigner.nodeParamsSaved'));
    });
  };

  const handleSave = async () => {
    let makePolicy = true; // 默认开启
    modal.confirm({
        title: t('pipelineDesigner.title'),
        width: 500,
        content: (
            <div className="mt-4 flex flex-col gap-4">
                <div>
                   <Text type="secondary" className="text-xs mb-1 block">{t('pipelineDesigner.pipelineUniqueName')}</Text>
                   <Input id="pipeline-name-input" defaultValue={pipelineInfo?.name} placeholder={t('pipelineDesigner.enterPipelineName')} className="rounded-lg h-10" />
                </div>
                <div>
                   <Text type="secondary" className="text-xs mb-1 block">{t('pipelineDesigner.cronExpressionOptional')}</Text>
                   <Input id="pipeline-cron-input" defaultValue={pipelineInfo?.schedule_cron} placeholder={t('pipelineDesigner.enterCronExpression')} className="font-mono rounded-lg h-10" />
                </div>
                <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                    <Text type="secondary" className="text-[11px] block">{t('pipelineDesigner.cronFormatTip')}</Text>
                </div>

                {sourceAlertId && (
                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                        <Checkbox 
                            defaultChecked={true} 
                            onChange={(e) => { makePolicy = e.target.checked; }}
                        >
                            <span className="text-xs font-medium text-primary">{t('pipelineDesigner.associateWithAlert')}</span>
                        </Checkbox>
                        <Text type="secondary" className="text-[10px] block mt-1 ml-6">
                            {t('pipelineDesigner.associateWithAlertTip')}
                        </Text>
                    </div>
                )}
            </div>
        ),
        onOk: () => {
            const nameInput = document.getElementById('pipeline-name-input') as HTMLInputElement;
            const cronInput = document.getElementById('pipeline-cron-input') as HTMLInputElement;
            if (!nameInput.value) { message.warning(t('pipelineDesigner.mustEnterName')); return Promise.reject(); }
            submitPipeline(nameInput.value, cronInput.value, sourceAlertId ? makePolicy : undefined);
        }
    });
  };

  const submitPipeline = async (name: string, schedule_cron?: string, makePolicy?: boolean) => {
    const graphData = {
        nodes: nodesState,
        edges: edgesState,
        viewport: reactFlowInstance.getViewport(),
    };
    const payload = {
        name,
        schedule_cron: schedule_cron || null,
        graph_data: graphData,
        is_active: true
    };
    try {
        let savedPipelineId: number;
        if (pipelineId) {
            await updatePipeline(Number(pipelineId), payload);
            savedPipelineId = Number(pipelineId);
        } else {
            const res = await createPipeline(payload);
            savedPipelineId = res.id || res.data?.id;
            navigate(`/v1/pipeline/designer?id=${savedPipelineId}`);
        }

        // 如果是从告警诊断跳转来的，且用户确认绑定
        if (sourceAlertId && makePolicy !== undefined) {
            await bindHealingPipeline(sourceAlertId, {
                pipeline_id: savedPipelineId,
                make_policy: makePolicy
            });
            message.success(t('pipelineDesigner.healingPolicyCreated'));
            setSourceAlertId(null); // 完成闭环，重置状态
        }

        message.success(t('pipelineDesigner.pipelineScheduleSyncSuccess'));
    } catch(e: any) { message.error(e.message); }
  };

  const handleExplain = async () => {
    if (nodes.length === 0) {
      message.warning(t('pipelineDesigner.addNodesFirst'));
      return;
    }
    
    const hide = message.loading(t('pipelineDesigner.generatingSimulation'), 0);
    try {
      const res = await explainPipeline({
        nodes,
        edges,
        llm_id: selectedLLMId
      });
      hide();
      
      modal.info({
        title: t('pipelineDesigner.aiSimulationTitle'),
        width: 700,
        content: (
          <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
             <div className="prose prose-slate max-w-none prose-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {res.explanation}
                </ReactMarkdown>
             </div>
          </div>
        ),
        okText: t('pipelineDesigner.confirmAndRun'),
        cancelText: t('pipelineDesigner.close'),
        closable: true,
        onOk: () => handleRun()
      });
    } catch (e: any) {
      hide();
      message.error(t('pipelineDesigner.simulationFailed') + ': ' + e.message);
    }
  };

  const handleRun = async () => {
      if (!pipelineId) { message.warning(t('pipelineDesigner.saveFirstBeforeRun')); return; }
      try {
          const res = await executePipeline(Number(pipelineId));
          // 处理审批拦截 (202 Accepted)
          if (res.code === 202 || res.status === 'pending_approval' || (res as any).ticket_id) {
                modal.confirm({
                    title: t('pipelineDesigner.operationRequiresApproval'),
                    icon: <SettingOutlined style={{ color: '#faad14' }} />,
                    content: (
                        <div className="mt-2">
                            <p className="font-bold text-amber-600">{res.message || t('pipelineDesigner.systemSecurityProtection')}</p>
                            <p className="text-xs text-gray-500 mt-2">该流水线已被安全策略拦截，需管理员审批通过后方可继续执行。您可以前往审批中心查看详情。</p>
                        </div>
                    ),
                    okText: '前往审批中心',
                    cancelText: t('pipelineDesigner.ok'),
                    onOk: () => navigate('/v1/approval/tickets')
                });
                return;
          }
          const runId = res.run_id || res.data?.run_id;
          if (runId) {
            message.success(t('pipeline.executeSuccess', { runId }));
            navigate(`/v1/pipeline/runs/${runId}`);
          }
      } catch (e: any) { 
          // 容错处理：部分拦截可能走 catch 流程（取决于 Axios 封装）
          if (e.response?.status === 202) {
              const res = e.response.data;
              modal.info({
                  title: t('pipelineDesigner.operationRequiresApproval'),
                  content: res.message || '操作已进入审批流',
                  onOk: () => navigate('/v1/approval/tickets')
              });
          } else {
              message.error(e.message); 
          }
      }
  };

  const nodeTemplates = useMemo(() => [
          { type: 'ansible', label: t('pipelineDesigner.ansibleTaskNode'), icon: <CodeOutlined />, description: t('pipelineDesigner.executeAnsiblePlaybook') },
          { type: 'git_clone', label: t('pipelineDesigner.gitSourceClone'), icon: <GithubOutlined />, description: t('pipelineDesigner.codePull') },
          { type: 'docker_build', label: t('pipelineDesigner.dockerBuildNode'), icon: <ContainerOutlined />, description: t('pipelineDesigner.containerImageCompile') },
          { type: 'kaniko_build', label: t('pipelineDesigner.kanikoBuildNode'), icon: <ContainerOutlined />, description: t('pipelineDesigner.k8sInternalImageBuild') },
          { type: 'k8s_deploy', label: t('pipelineDesigner.k8sDeliveryNode'), icon: <CloudServerOutlined />, description: t('pipelineDesigner.clusterDeployment') },
          { type: 'http_webhook', label: t('pipelineDesigner.httpExternalCall'), icon: <ApiOutlined />, description: t('pipelineDesigner.webhookTrigger') },
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
        style={{ 
          background: token.colorBgContainer, 
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '12px 24px'
        }}
        className="flex flex-col gap-3 z-10 transition-colors"
      >
        {/* Row 1: Title and Basic Actions */}
        <div className="flex items-center justify-between">
          <Space size="middle">
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/v1/pipeline/list')} 
              className="hover:bg-slate-100 dark:hover:bg-white/10"
            />
            <div className="flex flex-col">
              <Title level={5} className="m-0!">{pipelineInfo?.name || t('pipelineDesigner.newPipelineEditor')}</Title>
              {pipelineId && <Text type="secondary" className="text-[10px] uppercase opacity-60">Blueprint ID: {pipelineId}</Text>}
            </div>
          </Space>
          <Space>
            {hasPermission('pipeline:template:edit') && (
              <Button 
                icon={<SaveOutlined />} 
                type="dashed"
                onClick={handleSave}
                className="border-primary/50 text-primary hover:border-primary"
              >
                {t('pipelineDesigner.save')}
              </Button>
            )}
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/v1/pipeline/list')}
            >
              {t('pipelineDesigner.return')}
            </Button>
          </Space>
        </div>

        {/* Row 2: AI Co-pilot Toolbar */}
        <div 
          className="flex items-center justify-between p-2 rounded-xl border border-solid transition-all"
          style={{ 
            backgroundColor: token.colorFillAlter,
            borderColor: token.colorBorderSecondary 
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-solid border-purple-100 dark:border-purple-900/30">
              <RobotOutlined className="text-purple-500" />
              <Text strong className="text-xs text-purple-600 uppercase tracking-wider">AI Copilot</Text>
            </div>
            
            <Select
              placeholder="AI 模型"
              style={{ width: 160 }}
              value={selectedLLMId}
              onChange={setSelectedLLMId}
              options={llmModels.map(m => ({ label: m.display_name, value: m.id }))}
              variant="filled"
              className="rounded-lg"
            />

            <Input.Search
              placeholder={nodes.length > 0 ? "描述修改需求 (如: 在最后加个通知节点)..." : "描述流水线需求 (如: 自动部署 K8s)..."}
              enterButton={
                <Space>
                  <ThunderboltOutlined />
                  <span>AI {nodes.length > 0 ? '修正' : '编排'}</span>
                </Space>
              }
              size="middle"
              loading={aiMutation.isPending}
              onSearch={(val) => aiMutation.mutate(val)}
              style={{ width: 400 }}
            />

            <Button 
              icon={<RobotOutlined />} 
              onClick={handleExplain}
              className="border-purple-300 text-purple-600 hover:text-purple-700 hover:border-purple-400 bg-white/50"
            >
              {t('pipelineDesigner.aiSimulation')}
            </Button>
          </div>

          <Space>
            <Divider type="vertical" className="h-8 border-slate-300 dark:border-slate-600" />
            {hasPermission('pipeline:template:execute') && (
              <Button 
                icon={<PlayCircleOutlined />} 
                type="primary" 
                onClick={handleRun} 
                disabled={!pipelineId} 
                className="shadow-md h-9 px-6 rounded-lg"
              >
                {t('pipelineDesigner.execute')}
              </Button>
            )}
          </Space>
        </div>
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
                        {t('pipelineDesigner.componentList')}
                    </Text>
                    <Text type="secondary" className="text-[12px] uppercase tracking-widest">
                        {t('pipelineDesigner.dragComponentToCanvas')}
                    </Text>
                </Flex>


                <div className="flex flex-col gap-3">
                    {nodeTemplates.map((node) => {
                      return (
                        <div
                            key={node.type}
                            style={{
                                background: token.colorBgContainer,
                                borderLeft: `4px solid ${token.colorPrimary}`,
                                borderColor: token.colorBorderSecondary
                            }}
                            className="p-4 border border-solid rounded-xl cursor-grab hover:shadow-lg transition-all group flex items-start gap-3"
                            onDragStart={(event) => onDragStart(event, node.type)}
                            draggable
                        >
                            <div
                              style={{ color: token.colorPrimary, backgroundColor: token.colorPrimaryBg }}
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
        title={<Space><SettingOutlined className="text-blue-500" /><span>{t('pipelineDesigner.configNode', { type: selectedNode?.type })}</span></Space>}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        size={450}
        extra={
            <Space>
                {hasPermission('pipeline:template:edit') && (
                    <Button 
                        icon={<RobotOutlined />} 
                        onClick={handleNodeAI} 
                        loading={isNodeAILoading}
                        className="border-purple-300 text-purple-600 hover:text-purple-700 hover:border-purple-400"
                    >
                        AI 助手
                    </Button>
                )}
                {hasPermission('pipeline:template:edit') && (
                    <Button type="primary" size="small" onClick={onDrawerSave}>
                        {t('pipelineDesigner.saveConfig')}
                    </Button>
                )}
            </Space>
        }
        className="custom-drawer"
      >
        <Form form={form} layout="vertical" className="px-1 pt-4">
          <Card size="small" title={t('pipelineDesigner.basicProperties')} className="mb-5 border-none shadow-sm">
            <Form.Item label={t('pipelineDesigner.nodeIdentifier')} name="label">
              <Input placeholder={t('pipelineDesigner.enterNodeDisplayName')} className="rounded-lg h-10" />
            </Form.Item>
            <Space className="w-full justify-between">
              <Form.Item label={t('pipelineDesigner.maxRetryCount')} name="max_retries" initialValue={0} className="w-32 mb-0">
                <InputNumber min={0} max={10} className="w-full h-9 flex items-center" />
              </Form.Item>
              <Form.Item label={t('pipelineDesigner.retryIntervalSeconds')} name="retry_delay" initialValue={10} className="w-32 mb-0">
                <InputNumber min={1} className="w-full h-9 flex items-center" />
              </Form.Item>
            </Space>
          </Card>

          {selectedNode?.type === 'git_clone' && (
            <Card size="small" title={t('pipelineDesigner.sourceCodeConfig')} className="mb-5 border-none shadow-sm">
              <Form.Item label={t('pipelineDesigner.repoAddress')} name="git_repo" rules={[{ required: true }]}><Input placeholder="https://github.com/..." /></Form.Item>
              <Form.Item label={t('pipelineDesigner.branchName')} name="git_branch" initialValue="main"><Input /></Form.Item>
              <Form.Item label={t('pipelineDesigner.identityAuthSshCredential')} name="credential_id">
                <Select
                  placeholder={t('pipelineDesigner.selectAuthCredentialOptional')}
                  allowClear
                  options={credentialsData?.results || credentialsData?.data || []}
                  fieldNames={{ label: 'name', value: 'id' }}
                />
              </Form.Item>
            </Card>
          )}

          {selectedNode?.type === 'docker_build' && (
            <Card size="small" title={t('pipelineDesigner.compileEnvironment')} className="mb-5 border-none shadow-sm">
              <Form.Item label={t('pipelineDesigner.executionSandbox')} name="ci_env_id" rules={[{ required: true }]}>
                <Select
                  placeholder={t('pipelineDesigner.selectBuildEnvironment')}
                  options={ciEnvsData?.data || []}
                  fieldNames={{ label: 'name', value: 'id' }}
                />
              </Form.Item>
              <Form.Item label={t('pipelineDesigner.compileCommand')} name="build_script" rules={[{ required: true }]}>
                <Input.TextArea rows={4} className="font-mono text-xs" />
              </Form.Item>
            </Card>
          )}

          {selectedNode?.type === 'kaniko_build' && (
            <Card size="small" title={t('pipelineDesigner.imagePush')} className="mb-5 border-none shadow-sm">
              <Form.Item label={t('pipelineDesigner.targetRegistry')} name="registry_id" rules={[{ required: true }]}>
                <Select
                  placeholder={t('pipelineDesigner.selectRegistry')}
                  options={registriesData?.data || (registriesData as any)?.results || []}
                  fieldNames={{ label: 'name', value: 'id' }}
                />
              </Form.Item>
              <Form.Item label={t('pipelineDesigner.imageName')} name="image_name" rules={[{ required: true }]}><Input placeholder={t('pipelineDesigner.enterImageName')} /></Form.Item>
              <Form.Item label={t('pipelineDesigner.imageTag')} name="image_tag" initialValue="latest"><Input placeholder={t('pipelineDesigner.enterImageTag')} /></Form.Item>
              <Form.Item label={t('pipelineDesigner.dockerfile')} name="dockerfile_path" initialValue="Dockerfile"><Input /></Form.Item>
            </Card>
          )}

          {selectedNode?.type === 'ansible' && (
            <Card size="small" title={t('pipelineDesigner.ansibleAssociation')} className="mb-5 border-none shadow-sm">
              <Form.Item label={t('pipelineDesigner.taskTemplate')} name="ansible_task_id" rules={[{ required: true }]}>
                <Select
                  placeholder={t('pipelineDesigner.selectTask')}
                  options={ansibleTasksData?.data || []}
                  fieldNames={{ label: 'name', value: 'id' }}
                />
              </Form.Item>
            </Card>
          )}

          {selectedNode?.type === 'k8s_deploy' && (
             <>
               <Card size="small" title={t('pipelineDesigner.k8sDelivery')} className="mb-5 border-none shadow-sm">
                  <Form.Item label={t('pipelineDesigner.targetCluster')} name="k8s_cluster_id" rules={[{required: true}]}>
                    <Select
                      placeholder={t('pipelineDesigner.selectCluster')}
                      options={clustersData?.data || []}
                      fieldNames={{ label: 'name', value: 'id' }}
                      showSearch
                    />
                  </Form.Item>
                  <Form.Item label={t('pipelineDesigner.releaseName')} name="k8s_release_name" rules={[{required: true}]}>
                      <Input placeholder={t('pipelineDesigner.enterReleaseName')} />
                  </Form.Item>
                  <Form.Item label={t('pipelineDesigner.namespace')} name="k8s_namespace" initialValue="default">
                      <Input placeholder="default" />
                  </Form.Item>
               </Card>
               <Card size="small" title={t('pipelineDesigner.helmConfig')} className="mb-5 border-none shadow-sm">
                  <Form.Item label={t('pipelineDesigner.localChart')} name="k8s_chart_name">
                      <Select
                         placeholder={t('pipelineDesigner.selectLocalChart')}
                         options={localChartsData || []}
                         fieldNames={{ label: 'name', value: 'id' }}
                         showSearch
                         allowClear
                      />
                  </Form.Item>
                  <Form.Item label={t('pipelineDesigner.forceExecute')} name="k8s_force" initialValue={false} tooltip={t('pipelineDesigner.forceExecuteTooltip')}>
                      <Select options={[{ label: t('pipelineDesigner.closeRecommended'), value: false }, { label: t('pipelineDesigner.enableConflictResolution'), value: true }]} />
                  </Form.Item>
               </Card>
               <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-dashed border-amber-200 dark:border-amber-700 mb-5">
                   <Text className="text-[11px] text-amber-700 dark:text-amber-500 block leading-relaxed">
                       {t('pipelineDesigner.tipConflictError')}
                   </Text>
               </div>
             </>
          )}

          {selectedNode?.type === 'http_webhook' && (
             <Card size="small" title={t('pipelineDesigner.webhookConfig')} className="mb-5 border-none shadow-sm">
                <Form.Item label={t('pipelineDesigner.url')} name="webhook_url" rules={[{required:true}]}>
                   <Input placeholder="https://..." />
                </Form.Item>
                <Form.Item label={t('pipelineDesigner.method')} name="webhook_method" initialValue="POST">
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
  const { isMobile } = useBreakpoint();
  const { t } = useTranslation();

  if (isMobile) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">💻</div>
          <h2 className="text-lg font-semibold mb-2">{t('pipelineDesigner.mobileBlockedTitle')}</h2>
          <p className="text-gray-500 text-sm">{t('pipelineDesigner.mobileBlockedDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full antialiased">
      <ReactFlowProvider>
        <DesignerCore />
      </ReactFlowProvider>
    </div>
  );
}
