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
  ApiOutlined,
  UserOutlined,
  InfoCircleOutlined
  } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
  import { useTranslation } from 'react-i18next';

import { getAnsibleTasks } from '../../api/tasks';
import { getK8sClusters, getHelmLocalCharts, getHelmRepositories } from '../../api/k8s';
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
import ApprovalNode from './nodes/ApprovalNode';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;

const nodeTypes = {
  ansible: AnsibleNode,
  k8s_deploy: K8sNode,
  http_webhook: HttpNode,
  git_clone: GitNode,
  docker_build: BuildNode,
  kaniko_build: KanikoNode,
  approval: ApprovalNode,
  host_deploy: AnsibleNode,
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

  const { 
    nodes, setNodes, 
    edges, setEdges, 
    editingId, setEditingId,
    lastModified,
    resetDesigner, clearDesigner,
    sourceAlertId, setSourceAlertId 
  } = useDesignerStore();

  const [nodesState, setNodesState, onNodesChangeOriginal] = useNodesState([]);
  const [edgesState, setEdgesState, onEdgesChangeOriginal] = useEdgesState([]);

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const { token } = theme.useToken();
  const { modal, message } = App.useApp();
  const { token: authToken, hasPermission } = useAppStore();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pipelineId = searchParams.get('id');
  const [pipelineInfo, setPipelineInfo] = useState<any>(null);

  // --- 核心优化：草稿冲突处理与自动回填 ---
  useEffect(() => {
    const initDesigner = async () => {
      // 1. 如果有缓存的草稿且 ID 不匹配，询问用户
      if (nodes.length > 0 && editingId !== pipelineId) {
        modal.confirm({
          title: t('pipelineDesigner.unsavedChangesDetected'),
          content: t('pipelineDesigner.unsavedChangesDesc', { 
            type: editingId ? t('pipelineDesigner.editMode') : t('pipelineDesigner.newMode'),
            time: new Date(lastModified).toLocaleString()
          }),
          okText: t('pipelineDesigner.restoreDraft'),
          cancelText: t('pipelineDesigner.discardDraft'),
          onOk: () => {
            // 恢复草稿，但不修改 editingId，直到用户保存
            setNodesState(nodes);
            setEdgesState(edges);
          },
          onCancel: () => {
            clearDesigner();
            if (pipelineId) {
                loadRemotePipeline(pipelineId);
            } else {
                setNodesState([]);
                setEdgesState([]);
            }
          }
        });
        return;
      }

      // 2. 如果是新建（无 pipelineId），且没有冲突草稿，则初始化为空
      if (!pipelineId) {
        if (nodes.length === 0) {
            setNodesState([]);
            setEdgesState([]);
        } else {
            setNodesState(nodes);
            setEdgesState(edges);
        }
        setEditingId(null);
        return;
      }

      // 3. 如果是编辑已有 Pipeline
      if (pipelineId) {
        // 如果缓存匹配，直接用缓存
        if (editingId === pipelineId && nodes.length > 0) {
            setNodesState(nodes);
            setEdgesState(edges);
            // 异步加载基础信息（不覆盖画布）
            getPipeline(Number(pipelineId)).then(res => setPipelineInfo(res.data || res));
        } else {
            // 否则加载远程数据
            loadRemotePipeline(pipelineId);
        }
      }
    };

    if (reactFlowInstance) {
        initDesigner();
    }
  }, [pipelineId, reactFlowInstance]); // 仅在路由 ID 或 实例初始化时触发

  const loadRemotePipeline = (id: string) => {
    getPipeline(Number(id)).then((res) => {
        const data = res.data || res;
        setPipelineInfo(data);
        if (data.graph_data) {
          // 核心修复：确保每个节点都有 position 字段，防止 ReactFlow 渲染报错
          const rawNodes = data.graph_data.nodes || [];
          const remoteNodes = rawNodes.map((node: any, index: number) => ({
            ...node,
            position: node.position || { x: 100 + index * 250, y: 150 }
          }));
          
          const remoteEdges = data.graph_data.edges || [];
          setNodesState(remoteNodes);
          setEdgesState(remoteEdges);
          // 同步到缓存
          setNodes(remoteNodes);
          setEdges(remoteEdges);
          setEditingId(id);
          
          setTimeout(() => {
            if (data.graph_data.viewport) {
              reactFlowInstance.setViewport(data.graph_data.viewport);
            } else reactFlowInstance.fitView();
          }, 10);
        }
    });
  };

  // 包装 Change 事件，同步到 Store (带节流效果更佳，这里先实现同步)
  const onNodesChange = useCallback((changes: any) => {
    onNodesChangeOriginal(changes);
    // 这里不能直接用 nodesState，因为 setState 是异步的
    // 更好的做法是在 useEffect 中监听 nodesState 变化并同步
  }, [onNodesChangeOriginal]);

  const onEdgesChange = useCallback((changes: any) => {
    onEdgesChangeOriginal(changes);
  }, [onEdgesChangeOriginal]);

  // 实时同步到 Store
  useEffect(() => {
    if (nodesState.length > 0 || edgesState.length > 0) {
        setNodes(nodesState);
        setEdges(edgesState);
    }
  }, [nodesState, edgesState, setNodes, setEdges]);

  const { data: ansibleTasksData } = useQuery({
    queryKey: ['ansibleTasksPipeline'],
    queryFn: () => getAnsibleTasks({ page_size: 200 }),
    enabled: !!authToken && hasPermission('pipeline:template:view'),
  });

  const { data: clustersData } = useQuery({
    queryKey: ['k8s-clusters'],
    queryFn: () => getK8sClusters({ page_size: 200 }),
    enabled: !!authToken && hasPermission('pipeline:template:view'),
  });

  const { data: repositoriesData } = useQuery({
    queryKey: ['helm-repositories'],
    queryFn: () => getHelmRepositories({ page_size: 200 }),
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
      message.success(t('pipelineDesigner.aiRecommendedParams'));
    } catch (e: any) {
      message.error(t('pipelineDesigner.aiAssistFailed', { message: e.message || t('pipelineDesigner.unknownError') }));
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
            label: node.data?.label || node.label || t('pipelineDesigner.aiNodeLabel', { index: idx + 1 })
          }
        }));
        
        setNodes(safeNodes);
        setEdges(data.edges || []);
        setNodesState(safeNodes);
        setEdgesState(data.edges || []);
        message.success(nodes.length > 0 ? t('pipelineDesigner.pipelineOptimized') : t('pipelineDesigner.pipelineGenerated'));
        setAiPrompt('');
      }
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || t('pipelineDesigner.aiOrchestrationFailed'));
    }
  });

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
        data: { label: t('pipelineDesigner.typedNodeLabel', { type }) },
      };

      const updatedNodes = [...nodesState, newNode];
      setNodesState(updatedNodes);
      setNodes(updatedNodes);
    },
    [reactFlowInstance, nodesState, setNodes, setNodesState, t]
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
                <div className="bg-ans-bg-layout/50 p-3 rounded-ans-md border border-dashed border-ans-border">
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
        }

        // 保存成功后清除缓存
        clearDesigner();

        if (!pipelineId) {
            navigate(`/v1/pipeline/designer?id=${savedPipelineId}`, { replace: true });
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
                            <p className="font-bold text-ans-warning">{res.message || t('pipelineDesigner.systemSecurityProtection')}</p>
                            <p className="text-xs text-ans-text-secondary mt-2 opacity-80">{t('pipelineDesigner.approvalInterceptDesc')}</p>
                        </div>
                    ),
                    okText: t('pipelineDesigner.goToApprovalCenter'),
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
                  content: res.message || t('pipelineDesigner.approvalFlowEntered'),
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
    <div style={{ background: 'var(--ans-bg-layout)' }} className="h-full w-full flex flex-col overflow-hidden antialiased">
      {/* Header Bar */}
      <header 
        className="flex flex-col gap-3 z-10 transition-colors bg-ans-bg-container border-b border-solid border-ans-border py-3 px-6"
      >
        {/* Row 1: Title and Basic Actions */}
        <div className="flex items-center justify-between">
          <Space size="middle">
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/v1/pipeline/list')} 
              className="hover:bg-ans-primary/5"
            />
            <div className="flex flex-col">
              <Title level={5} className="m-0!">{pipelineInfo?.name || t('pipelineDesigner.newPipelineEditor')}</Title>
              {pipelineId && <Text type="secondary" className="text-[10px] uppercase opacity-60">ID: {pipelineId}</Text>}
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
          className="flex items-center justify-between p-2 rounded-ans-lg border border-solid transition-all bg-ans-bg-layout/50 border-ans-border"
        >
          <div className="flex items-center gap-3">
            <div 
              className="flex items-center gap-2 px-3 py-1 rounded-ans-sm shadow-sm border border-solid transition-colors bg-ans-bg-container"
              style={{ borderColor: 'color-mix(in srgb, var(--ans-primary), transparent 80%)' }}
            >
              <RobotOutlined style={{ color: 'var(--ans-primary)' }} />
              <span className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--ans-primary)' }}>
                {t('aiChatbot.title')}
              </span>
            </div>
            
            <Select
              placeholder={t('pipelineDesigner.aiModel')}
              style={{ width: 160 }}
              value={selectedLLMId}
              onChange={setSelectedLLMId}
              options={llmModels.map(m => ({ label: m.display_name, value: m.id }))}
              variant="filled"
              className="rounded-lg"
            />

            <Input.Search
              placeholder={nodes.length > 0 ? t('pipelineDesigner.refineRequirementPlaceholder') : t('pipelineDesigner.generateRequirementPlaceholder')}
              enterButton={
                <Space>
                  <ThunderboltOutlined />
                  <span>{nodes.length > 0 ? t('pipelineDesigner.aiRefine') : t('pipelineDesigner.aiOrchestrate')}</span>
                </Space>
              }
              size="middle"
              loading={aiMutation.isPending}
              onSearch={(val) => aiMutation.mutate(val)}
              style={{ width: 400 }}
            />

            <Button 
              icon={<RobotOutlined style={{ color: 'var(--ans-primary)' }} />} 
              onClick={handleExplain}
              style={{ 
                borderColor: 'color-mix(in srgb, var(--ans-primary), transparent 60%)',
                color: 'var(--ans-primary)'
              }}
              className="bg-ans-bg-container hover:opacity-80 transition-opacity"
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

      <Layout className="flex-1 overflow-hidden bg-transparent">
        <Sider 
            width={280} 
            className="overflow-y-auto bg-ans-bg-container border-r border-solid border-ans-border"
        >
            <div className="p-5 flex flex-col gap-4">
                <Flex vertical gap={2}>
                    <Text strong className="text-[16px] uppercase tracking-widest text-ans-text-primary">
                        {t('pipelineDesigner.componentList')}
                    </Text>
                    <Text className="text-[12px] uppercase tracking-widest text-ans-text-secondary opacity-80">
                        {t('pipelineDesigner.dragComponentToCanvas')}
                    </Text>
                </Flex>


                <div className="flex flex-col gap-3">
                    {nodeTemplates.map((node) => {
                      return (
                        <div
                            key={node.type}
                            style={{ borderLeft: '4px solid var(--ans-primary)' }}
                            className="p-4 border border-solid border-ans-border bg-ans-bg-container rounded-ans-md cursor-grab hover:shadow-ans-soft transition-all group flex items-start gap-3"
                            onDragStart={(event) => onDragStart(event, node.type)}
                            draggable
                        >
                            <div
                              style={{ color: 'var(--ans-primary)', backgroundColor: 'color-mix(in srgb, var(--ans-primary), transparent 90%)' }}
                              className="w-10 h-10 rounded-ans-sm flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform"
                            >
                                {node.icon}
                            </div>
                            <div className="flex flex-col flex-1">
                                <span className="font-bold text-sm text-ans-text-primary">{node.label}</span>
                                <span className="text-[10px] mt-0.5 leading-tight text-ans-text-secondary opacity-70">{node.description}</span>
                            </div>
                        </div>
                      );
                    })}
                </div>
            </div>
        </Sider>
        
        <Content 
            style={{ background: 'var(--ans-bg-layout)' }}
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
                    <Background gap={32} size={1} color="var(--ans-border)" />
                    <Controls style={{ background: 'var(--ans-bg-container)', border: 'none', boxShadow: 'var(--ans-shadow-soft)' }} />
                    <MiniMap style={{ background: 'var(--ans-bg-container)', borderColor: 'var(--ans-border)', borderRadius: 'var(--ans-radius-lg)' }} />
                </ReactFlow>
            </div>
        </Content>
      </Layout>

      <Drawer
        title={<Space><SettingOutlined style={{ color: 'var(--ans-primary)' }} /><span>{t('pipelineDesigner.configNode', { type: selectedNode?.type })}</span></Space>}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        size={450}
        extra={
            <Space>
                {hasPermission('pipeline:template:edit') && (
                    <Button
                        icon={<RobotOutlined style={{ color: 'var(--ans-primary)' }} />}
                        onClick={handleNodeAI}
                        loading={isNodeAILoading}
                        style={{ 
                            borderColor: 'color-mix(in srgb, var(--ans-primary), transparent 60%)',
                            color: 'var(--ans-primary)'
                        }}
                    >
                        {t('aiChatbot.title')}
                    </Button>
                )}
                {hasPermission('pipeline:template:edit') && (
                    <Button type="primary" size="small" onClick={onDrawerSave} className="shadow-none rounded-ans-sm font-bold">
                        {t('pipelineDesigner.saveConfig')}
                    </Button>
                )}
            </Space>
        }
        className="custom-drawer"
      >
        <Form form={form} layout="vertical" className="px-1 pt-4">
          <Card size="small" title={t('pipelineDesigner.basicProperties')} className="mb-5 ans-card border-none bg-ans-bg-container">
            <div className="mb-4 p-2 bg-ans-bg-layout/50 rounded-ans-md border border-dashed border-ans-border flex justify-between items-center">
               <Text type="secondary" className="text-[10px] uppercase text-ans-text-secondary">{t('pipelineDesigner.nodeId')}: <code className="text-ans-primary font-bold">{selectedNode?.id}</code></Text>
               <Button 
                type="link" 
                size="small" 
                className="text-[10px] p-0 h-auto font-bold opacity-80 hover:opacity-100"
                style={{ color: 'var(--ans-primary)' }}
                onClick={() => {
                  navigator.clipboard.writeText(selectedNode?.id || '');
                  message.success(t('common.copied'));
                }}
               >
                 {t('common.copy')}
               </Button>
            </div>
            <Form.Item label={t('pipelineDesigner.nodeIdentifier')} name="label">
              <Input placeholder={t('pipelineDesigner.enterNodeDisplayName')} className="rounded-ans-md h-10 border-ans-border bg-ans-bg-layout/30 hover:border-ans-primary" />
            </Form.Item>
            <Space className="w-full justify-between">
              <Form.Item label={t('pipelineDesigner.maxRetryCount')} name="max_retries" initialValue={0} className="w-32 mb-0">
                <InputNumber min={0} max={10} className="w-full h-9 flex items-center rounded-ans-md border-ans-border bg-ans-bg-layout/30" />
              </Form.Item>
              <Form.Item label={t('pipelineDesigner.retryIntervalSeconds')} name="retry_delay" initialValue={10} className="w-32 mb-0">
                <InputNumber min={1} className="w-full h-9 flex items-center rounded-ans-md border-ans-border bg-ans-bg-layout/30" />
              </Form.Item>
            </Space>
            <div className="mt-4 text-[10px] text-ans-text-secondary opacity-70">
              <InfoCircleOutlined className="mr-1" />
              {t('pipelineDesigner.variableReferenceSupport')}<code className="bg-ans-bg-layout border border-ans-border px-1.5 py-0.5 rounded-sm ml-1 text-ans-primary font-bold">{'{{ nodes.' + (selectedNode?.id || 'ID') + '.KEY }}'}</code>
            </div>
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

          {selectedNode?.type === 'approval' && (
            <Card size="small" title={t('pipelineDesigner.approvalConfig')} className="mb-5 border-none shadow-sm">
              <Form.Item label={t('pipelineDesigner.approvalMethod')} name="approver_type" initialValue="role" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="role">{t('pipelineDesigner.roleApprovalRecommended')}</Select.Option>
                  <Select.Option value="user">{t('pipelineDesigner.specificUser')}</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item 
                noStyle 
                shouldUpdate={(prev, curr) => prev.approver_type !== curr.approver_type}
              >
                {({ getFieldValue }) => (
                  getFieldValue('approver_type') === 'role' ? (
                    <Form.Item label={t('pipelineDesigner.approvalRole')} name="role_id" rules={[{ required: true }]}>
                      <Select 
                        placeholder={t('pipelineDesigner.selectApprovalRole')}
                        options={[{label: t('pipelineDesigner.superAdmin'), value: 1}, {label: t('pipelineDesigner.opsManager'), value: 2}]} 
                      />
                    </Form.Item>
                  ) : (
                    <Form.Item label={t('pipelineDesigner.approver')} name="user_id" rules={[{ required: true }]}>
                      <Select placeholder={t('pipelineDesigner.selectApprover')} />
                    </Form.Item>
                  )
                )}
              </Form.Item>
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
                  <div className="flex gap-4">
                    <Form.Item label={t('pipelineDesigner.helmRepository')} name="k8s_repo_id" className="flex-1">
                        <Select
                           placeholder={t('pipelineDesigner.selectRemoteRepo')}
                           options={repositoriesData?.data || []}
                           fieldNames={{ label: 'name', value: 'id' }}
                           allowClear
                        />
                    </Form.Item>
                    <Form.Item label={t('pipelineDesigner.localChart')} name="k8s_chart_name" className="flex-1">
                        <Select
                           placeholder={t('pipelineDesigner.selectLocalChart')}
                           options={localChartsData || []}
                           fieldNames={{ label: 'name', value: 'id' }}
                           showSearch
                           allowClear
                        />
                    </Form.Item>
                  </div>
                  <Form.Item label={t('pipelineDesigner.customValuesYaml')} name="k8s_values" tooltip={t('pipelineDesigner.customValuesTip')}>
                      <Input.TextArea rows={6} placeholder={`image:\n  pullPolicy: Always\nreplicaCount: 1`} className="font-mono text-[11px]" />
                  </Form.Item>
                  <Form.Item label={t('pipelineDesigner.forceExecute')} name="k8s_force" initialValue={false} tooltip={t('pipelineDesigner.forceExecuteTooltip')}>
                      <Select options={[{ label: t('pipelineDesigner.closeRecommended'), value: false }, { label: t('pipelineDesigner.enableConflictResolution'), value: true }]} />
                  </Form.Item>
               </Card>
               <div className="bg-ans-warning/10 p-3 rounded-ans-md border border-dashed border-ans-warning/30 mb-5">
                   <Text className="text-[11px] text-ans-warning block leading-relaxed">
                       {t('pipelineDesigner.tipConflictError')}
                   </Text>
               </div>
             </>
          )}

          {selectedNode?.type === 'http_webhook' && (
             <Card size="small" title={t('pipelineDesigner.webhookConfig')} className="mb-5 ans-card border-none bg-ans-bg-container">
                <Form.Item label={t('pipelineDesigner.url')} name="webhook_url" rules={[{required:true}]}>
                   <Input placeholder="https://..." className="rounded-ans-md border-ans-border bg-ans-bg-layout/30" />
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
      <div className="h-full w-full flex items-center justify-center p-6 bg-ans-bg-layout">
        <div className="text-center">
          <div className="text-5xl mb-4">💻</div>
          <h2 className="text-lg font-semibold mb-2 text-ans-text-primary">{t('pipelineDesigner.mobileBlockedTitle')}</h2>
          <p className="text-ans-text-secondary text-sm opacity-80">{t('pipelineDesigner.mobileBlockedDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full antialiased bg-ans-bg-layout">
      <ReactFlowProvider>
        <DesignerCore />
      </ReactFlowProvider>
    </div>
  );
}
